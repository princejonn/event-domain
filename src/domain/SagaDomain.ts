import EventEmitter from "events";
import { DomainEvent } from "../message";
import { ISagaDomain, SagaDomainOptions } from "../types";
import { Logger } from "@lindorm-io/winston";
import { MessageBus, SagaStore } from "../infrastructure";
import { Saga } from "../entity";
import { SagaEventHandler } from "../handler";
import { cloneDeep, find, findLast, isArray, isUndefined, some } from "lodash";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  SagaAlreadyCreatedError,
  SagaDestroyedError,
  SagaNotCreatedError,
} from "../error";
import {
  EventEmitterCallback,
  EventType,
  HandlerIdentifier,
  SagaEventHandlerContext,
} from "../types";

export class SagaDomain<State> implements ISagaDomain<State> {
  private readonly eventEmitter: EventEmitter;
  private readonly eventHandlers: Array<SagaEventHandler<State>>;
  private readonly logger: Logger;
  private messageBus: MessageBus;
  private sagaStore: SagaStore<State>;

  constructor(options: SagaDomainOptions) {
    this.logger = options.logger.createChildLogger(["SagaDomain"]);

    this.sagaStore = new SagaStore(this.logger, options.sagaStore);
    this.messageBus = new MessageBus(this.logger, options.messageBus);

    this.eventEmitter = new EventEmitter();
    this.eventHandlers = [];
  }

  public on<SagaState>(evt: EventType, callback: EventEmitterCallback<SagaState>): void {
    this.eventEmitter.on(evt, callback);
  }

  public async registerEventHandler(eventHandler: SagaEventHandler<State>): Promise<void> {
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
          handler.saga.name === eventHandler.saga.name &&
          handler.saga.context === eventHandler.saga.context,
      );

      if (existingHandler) {
        throw new Error("Event handler has already been registered");
      }

      if (!(eventHandler instanceof SagaEventHandler)) {
        throw new Error("Event handler is not of type: SagaDomainEventHandler");
      }

      this.eventHandlers.push(
        new SagaEventHandler({
          eventName: eventHandler.eventName,
          aggregate: {
            name: eventHandler.aggregate.name,
            context: context,
          },
          conditions: eventHandler.conditions,
          getSagaId: eventHandler.getSagaId,
          handler: eventHandler.handler,
          saga: eventHandler.saga,
          saveOptions: eventHandler.saveOptions,
        }),
      );

      this.logger.verbose("saga event handler registered", {
        eventName: eventHandler.eventName,
        aggregate: {
          name: eventHandler.aggregate.name,
          context: context,
        },
        conditions: eventHandler.conditions,
        saga: eventHandler.saga,
      });

      await this.messageBus.subscribe({
        callback: (event: DomainEvent) => this.handleEvent(event, eventHandler.saga),
        sub: {
          name: `${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}`,
          aggregate: {
            name: eventHandler.saga.name,
            context: eventHandler.saga.context,
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

  private async handleEvent(event: DomainEvent, sagaIdentifier: HandlerIdentifier): Promise<void> {
    this.logger.debug("saga domain handling event", { event, sagaIdentifier });

    const conditionValidators = [];

    const eventHandler = find(
      this.eventHandlers,
      (eventHandler) =>
        eventHandler.eventName === event.name &&
        eventHandler.aggregate.name === event.aggregate.name &&
        eventHandler.aggregate.context === event.aggregate.context &&
        eventHandler.saga.name === sagaIdentifier.name &&
        eventHandler.saga.context === sagaIdentifier.context,
    );

    if (!(eventHandler instanceof SagaEventHandler)) {
      throw new HandlerNotRegisteredError();
    }

    conditionValidators.push((saga: Saga<State>) => {
      if (saga.destroyed) {
        throw new SagaDestroyedError();
      }
    });

    if (eventHandler.conditions?.created === true) {
      conditionValidators.push((saga: Saga<State>) => {
        if (saga.revision < 1) {
          throw new SagaNotCreatedError(eventHandler.conditions.permanent === true);
        }
      });
    }

    if (eventHandler.conditions?.created === false) {
      conditionValidators.push((saga: Saga<State>) => {
        if (saga.revision > 0) {
          throw new SagaAlreadyCreatedError(
            isUndefined(eventHandler.conditions.permanent) ||
              eventHandler.conditions.permanent === true,
          );
        }
      });
    }

    const saga = await this.sagaStore.load({
      id: eventHandler.getSagaId(event),
      name: sagaIdentifier.name,
      context: sagaIdentifier.context,
    });

    this.logger.debug("saga", {
      id: saga.id,
      name: saga.name,
      context: saga.context,
      causationList: saga.causationList,
      messagesToDispatch: saga.messagesToDispatch,
      revision: saga.revision,
      state: saga.state,
    });

    const lastCausationMatchesEventId = findLast(
      saga.causationList,
      (causationId) => causationId === event.id,
    );

    try {
      if (!lastCausationMatchesEventId) {
        const savedSaga = await this.handleSaga(saga, event, eventHandler, conditionValidators);
        await this.publishCommands(savedSaga);

        this.logger.verbose("saga domain saved and handled event", {
          id: savedSaga.id,
          name: savedSaga.name,
          context: savedSaga.context,
          causationList: savedSaga.causationList,
          messagesToDispatch: savedSaga.messagesToDispatch,
          revision: savedSaga.revision,
          state: savedSaga.state,
        });
      } else {
        await this.publishCommands(saga);

        this.logger.verbose("saga domain published commands for saga at same revision", {
          id: saga.id,
          name: saga.name,
          context: saga.context,
          causationList: saga.causationList,
          messagesToDispatch: saga.messagesToDispatch,
          revision: saga.revision,
          state: saga.state,
        });
      }
    } catch (err) {
      if (err instanceof ConcurrencyError) {
        this.logger.warn("transient concurrency error while handling event", err);
      } else if (err instanceof DomainError) {
        this.logger.warn("domain error while handling event", err);
      } else {
        this.logger.error("failed to handle event", err);
      }

      throw err;
    }
  }

  private async handleSaga(
    saga: Saga<State>,
    event: DomainEvent,
    eventHandler: SagaEventHandler<State>,
    conditionValidators: Array<(saga: Saga<State>) => void>,
  ): Promise<Saga<State>> {
    const untouchedSaga = new Saga(saga.toJSON(), this.logger);

    try {
      for (const validator of conditionValidators) {
        validator(saga);
      }

      const context: SagaEventHandlerContext<State> = {
        event: event,
        state: cloneDeep(saga.state),
        logger: this.logger.createChildLogger(["SagaEventHandler"]),
        destroy: saga.destroy.bind(saga),
        dispatch: saga.dispatch.bind(saga, event),
        mergeState: saga.mergeState.bind(saga),
        setState: saga.setState.bind(saga),
        timeout: saga.timeout.bind(saga, event),
      };

      await eventHandler.handler(context);

      this.logger.debug("messages to dispatch", {
        messagesToDispatch: saga.messagesToDispatch,
      });

      const savedSaga = await this.sagaStore.save(saga, event, eventHandler.saveOptions);

      this.eventEmitter.emit("saga:success", event, savedSaga);

      return savedSaga;
    } catch (err) {
      if (err instanceof DomainError && err.permanent) {
        this.logger.error("failed to handle saga", err);

        untouchedSaga.messagesToDispatch.push(
          new DomainEvent(
            {
              id: `${event.id}.${err.name}`,
              name: err.name,
              aggregate: { id: saga.id, name: saga.name, context: saga.context },
              data: { error: err, message: event },
              mandatory: false,
            },
            event,
          ),
        );

        this.eventEmitter.emit("saga:error", err);

        return untouchedSaga;
      }

      this.eventEmitter.emit("saga:error", err);

      throw err;
    }
  }

  private async publishCommands(saga: Saga<State>): Promise<void> {
    if (saga.messagesToDispatch.length > 0) {
      await this.messageBus.publish(saga.messagesToDispatch);

      if (saga.revision > 0) {
        await this.sagaStore.clearMessagesToDispatch(saga);
      }
    }
  }
}
