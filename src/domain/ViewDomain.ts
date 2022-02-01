import EventEmitter from "events";
import { DomainEvent, Message } from "../message";
import { Logger } from "@lindorm-io/winston";
import { MessageBus, ViewStore } from "../infrastructure";
import { View } from "../entity";
import { ViewEventHandler } from "../handler";
import { cloneDeep, find, findLast, isArray, isUndefined, some } from "lodash";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  ViewAlreadyCreatedError,
  ViewDestroyedError,
  ViewNotCreatedError,
} from "../error";
import {
  EventEmitterCallback,
  EventType,
  HandlerIdentifier,
  IViewDomain,
  ViewDomainOptions,
  ViewEventHandlerContext,
  ViewStoreQuery,
} from "../types";

export class ViewDomain<State> implements IViewDomain<State> {
  private readonly eventEmitter: EventEmitter;
  private readonly eventHandlers: Array<ViewEventHandler<State>>;
  private readonly logger: Logger;
  private messageBus: MessageBus;
  private viewStore: ViewStore<State>;

  constructor(options: ViewDomainOptions) {
    this.logger = options.logger.createChildLogger(["ViewDomain"]);

    this.viewStore = new ViewStore(this.logger, options.viewStore);
    this.messageBus = new MessageBus(this.logger, options.messageBus);

    this.eventEmitter = new EventEmitter();
    this.eventHandlers = [];
  }

  public on<ViewState>(evt: EventType, callback: EventEmitterCallback<ViewState>): void {
    this.eventEmitter.on(evt, callback);
  }

  public async query(query: ViewStoreQuery): Promise<Array<View<State>>> {
    return this.viewStore.query(query);
  }

  public async registerEventHandler(eventHandler: ViewEventHandler<State>): Promise<void> {
    this.logger.debug("registering event handler", { name: eventHandler.eventName });

    const contexts = isArray(eventHandler.aggregate.context)
      ? eventHandler.aggregate.context
      : [eventHandler.aggregate.context];

    for (const context of contexts) {
      const existingHandler = some(
        this.eventHandlers,
        (handler) =>
          handler.eventName === eventHandler.eventName &&
          handler.aggregate.name === eventHandler.aggregate.name &&
          handler.aggregate.context === context &&
          handler.view.name === eventHandler.view.name &&
          handler.view.context === eventHandler.view.context,
      );

      if (existingHandler) {
        throw new Error("Event handler has already been registered");
      }

      if (!(eventHandler instanceof ViewEventHandler)) {
        throw new Error("Event handler is not of type: ViewDomainEventHandler");
      }

      this.eventHandlers.push(
        new ViewEventHandler({
          eventName: eventHandler.eventName,
          aggregate: {
            name: eventHandler.aggregate.name,
            context: context,
          },
          conditions: eventHandler.conditions,
          getViewId: eventHandler.getViewId,
          handler: eventHandler.handler,
          loadOptions: eventHandler.loadOptions,
          saveOptions: eventHandler.saveOptions,
          view: eventHandler.view,
        }),
      );

      this.logger.verbose("view event handler registered", {
        eventName: eventHandler.eventName,
        aggregate: {
          name: eventHandler.aggregate.name,
          context: context,
        },
        conditions: eventHandler.conditions,
        loadOptions: eventHandler.loadOptions,
        saveOptions: eventHandler.saveOptions,
        view: eventHandler.view,
      });

      await this.messageBus.subscribe({
        callback: (message: Message) => this.handleEvent(message, eventHandler.view),
        sub: {
          name: `${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}`,
          aggregate: {
            name: eventHandler.view.name,
            context: eventHandler.view.context,
          },
          handler: eventHandler.handler,
        },
        topic: {
          name: eventHandler.eventName,
          aggregate: {
            name: eventHandler.aggregate.name,
            context: context,
          },
          handler: eventHandler.handler,
        },
      });
    }
  }

  private async handleEvent(event: DomainEvent, viewIdentifier: HandlerIdentifier): Promise<void> {
    this.logger.debug("view domain handling message", { event });

    const conditionValidators = [];

    const eventHandler = find(
      this.eventHandlers,
      (eventHandler) =>
        eventHandler.eventName === event.name &&
        eventHandler.aggregate.name === event.aggregate.name &&
        eventHandler.aggregate.context === event.aggregate.context &&
        eventHandler.view.name === viewIdentifier.name &&
        eventHandler.view.context === viewIdentifier.context,
    );

    if (!(eventHandler instanceof ViewEventHandler)) {
      throw new HandlerNotRegisteredError();
    }

    conditionValidators.push((view: View<State>) => {
      if (view.destroyed) {
        throw new ViewDestroyedError();
      }
    });

    if (eventHandler.conditions?.created === true) {
      conditionValidators.push((view: View<State>) => {
        if (view.revision < 1) {
          throw new ViewNotCreatedError(eventHandler.conditions.permanent === true);
        }
      });
    }

    if (eventHandler.conditions?.created === false) {
      conditionValidators.push((view: View<State>) => {
        if (view.revision > 0) {
          throw new ViewAlreadyCreatedError(
            isUndefined(eventHandler.conditions.permanent) ||
              eventHandler.conditions.permanent === true,
          );
        }
      });
    }

    const view = await this.viewStore.load(
      {
        id: eventHandler.getViewId(event),
        name: viewIdentifier.name,
        context: viewIdentifier.context,
      },
      eventHandler.loadOptions,
    );

    const lastCausationMatchesEventId = findLast(
      view.causationList,
      (causationId) => causationId === event.id,
    );
    if (lastCausationMatchesEventId) return;

    try {
      for (const validator of conditionValidators) {
        validator(view);
      }

      const context: ViewEventHandlerContext<State> = {
        event: event,
        state: cloneDeep(view.state),
        logger: this.logger.createChildLogger(["ViewEventHandler"]),
        addField: view.addField.bind(view, event),
        destroy: view.destroy.bind(view),
        removeFieldWhereEqual: view.removeFieldWhereEqual.bind(view, event),
        removeFieldWhereMatch: view.removeFieldWhereMatch.bind(view, event),
        setState: view.setState.bind(view, event),
      };

      await eventHandler.handler(context);

      await this.viewStore.save(view, event, eventHandler.saveOptions);

      this.eventEmitter.emit("view:success", event, view);

      this.logger.verbose("view handled event");
    } catch (err) {
      if (err instanceof ConcurrencyError) {
        this.logger.warn("transient concurrency error while handling event", err);
      } else if (err instanceof DomainError) {
        this.logger.warn("domain error while handling event", err);
      } else {
        this.logger.error("failed to handle event", err);
      }

      this.eventEmitter.emit("view:error", err, event, view);

      if (err instanceof DomainError && err.permanent) {
        return await this.rejectEvent(event, view, err);
      }

      throw err;
    }
  }

  private async rejectEvent(
    event: DomainEvent,
    view: View<State>,
    error: DomainError,
  ): Promise<void> {
    try {
      this.logger.debug("rejecting event", { event });

      await this.messageBus.publish([
        new DomainEvent(
          {
            id: `${event.id}.${error.name}`,
            name: error.name,
            aggregate: { id: view.id, name: view.name, context: view.context },
            data: { error, message: event },
            mandatory: false,
          },
          event,
        ),
      ]);
    } catch (err) {
      this.logger.warn("failed to reject event", err);

      throw err;
    }
  }
}
