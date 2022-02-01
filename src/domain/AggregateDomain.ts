import EventEmitter from "events";
import { Aggregate } from "../entity";
import { AggregateCommandHandler, AggregateEventHandler } from "../handler";
import { Command, DomainEvent } from "../message";
import { EventStore, MessageBus } from "../infrastructure";
import { ExtendableError } from "@lindorm-io/errors";
import { Logger } from "@lindorm-io/winston";
import { cloneDeep, filter, find, findLast, some } from "lodash";
import {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
  CommandSchemaValidationError,
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
} from "../error";
import {
  AggregateCommandHandlerContext,
  AggregateDomainOptions,
  EventEmitterCallback,
  EventType,
  IAggregateDomain,
} from "../types";

export class AggregateDomain<State> implements IAggregateDomain<State> {
  private readonly commandHandlers: Array<AggregateCommandHandler<State>>;
  private readonly eventEmitter: EventEmitter;
  private readonly eventHandlers: Array<AggregateEventHandler<State>>;
  private readonly logger: Logger;
  private eventStore: EventStore<State>;
  private messageBus: MessageBus;

  constructor(options: AggregateDomainOptions) {
    this.logger = options.logger.createChildLogger(["AggregateDomain"]);

    this.eventStore = new EventStore(this.logger, options.eventStore);
    this.messageBus = new MessageBus(this.logger, options.messageBus);

    this.commandHandlers = [];
    this.eventEmitter = new EventEmitter();
    this.eventHandlers = [];
  }

  public on<AggregateState>(evt: EventType, callback: EventEmitterCallback<AggregateState>): void {
    this.eventEmitter.on(evt, callback);
  }

  public async registerCommandHandler(
    commandHandler: AggregateCommandHandler<State>,
  ): Promise<void> {
    this.logger.debug("registering command handler", {
      name: commandHandler.commandName,
    });

    const existingHandler = some(
      this.commandHandlers,
      (handler) =>
        handler.commandName === commandHandler.commandName &&
        handler.aggregate.name === commandHandler.aggregate.name &&
        handler.aggregate.context === commandHandler.aggregate.context,
    );

    if (existingHandler) {
      throw new Error("Command handler already registered");
    }

    if (!(commandHandler instanceof AggregateCommandHandler)) {
      throw new Error("Command handler is not of type: AggregateDomainCommandHandler");
    }

    this.commandHandlers.push(commandHandler);

    await this.messageBus.subscribe({
      callback: (command: Command) => this.handleCommand(command),
      sub: {
        name: commandHandler.commandName,
        aggregate: {
          name: commandHandler.aggregate.name,
          context: commandHandler.aggregate.context,
        },
        handler: commandHandler.handler,
      },
      topic: {
        name: commandHandler.commandName,
        aggregate: {
          name: commandHandler.aggregate.name,
          context: commandHandler.aggregate.context,
        },
        handler: commandHandler.handler,
      },
    });

    this.logger.debug("aggregate command handler registered", {
      name: commandHandler.commandName,
      aggregate: commandHandler.aggregate,
      conditions: commandHandler.conditions,
    });
  }

  public async registerEventHandler(eventHandler: AggregateEventHandler<State>): Promise<void> {
    this.logger.debug("registering event handler", { name: eventHandler.eventName });

    const existingHandler = some(
      this.eventHandlers,
      (handler) =>
        handler.eventName === eventHandler.eventName &&
        handler.aggregate.name === eventHandler.aggregate.name &&
        handler.aggregate.context === eventHandler.aggregate.context,
    );

    if (existingHandler) {
      throw new Error("Event handler already registered");
    }

    if (!(eventHandler instanceof AggregateEventHandler)) {
      throw new Error("Event handler is not of type: AggregateDomainEventHandler");
    }

    this.eventHandlers.push(eventHandler);

    this.logger.debug("aggregate event handler registered", {
      name: eventHandler.eventName,
      aggregate: eventHandler.aggregate,
    });
  }

  private async handleCommand(command: Command): Promise<void> {
    this.logger.debug("aggregate domain handling command", { command });

    const conditionValidators = [];

    const commandHandler = find(
      this.commandHandlers,
      (commandHandler) =>
        commandHandler.commandName === command.name &&
        commandHandler.aggregate.name === command.aggregate.name &&
        commandHandler.aggregate.context === command.aggregate.context,
    );

    if (!(commandHandler instanceof AggregateCommandHandler)) {
      throw new HandlerNotRegisteredError();
    }

    const eventHandlers = filter(
      this.eventHandlers,
      (eventHandler) =>
        eventHandler.aggregate.name === command.aggregate.name &&
        eventHandler.aggregate.context === command.aggregate.context,
    );

    conditionValidators.push((aggregate: Aggregate<State>) => {
      if (aggregate.destroyed) {
        throw new AggregateDestroyedError();
      }
    });

    if (commandHandler.conditions?.created === true) {
      conditionValidators.push((aggregate: Aggregate<State>) => {
        if (aggregate.events.length < 1) {
          throw new AggregateNotCreatedError();
        }
      });
    }

    if (commandHandler.conditions?.created === false) {
      conditionValidators.push((aggregate: Aggregate<State>) => {
        if (aggregate.events.length > 0) {
          throw new AggregateAlreadyCreatedError();
        }
      });
    }

    const aggregate = await this.eventStore.load(command.aggregate, eventHandlers);
    const lastCausationMatchesCommandId = findLast(aggregate.events, {
      causationId: command.id,
    });

    try {
      if (!lastCausationMatchesCommandId) {
        try {
          await commandHandler.schema.validateAsync(command.data);
        } catch (err) {
          throw new CommandSchemaValidationError(err);
        }

        for (const validator of conditionValidators) {
          validator(aggregate);
        }

        const context: AggregateCommandHandlerContext<State> = {
          command: command,
          state: cloneDeep(aggregate.state),
          logger: this.logger.createChildLogger(["AggregateCommandHandler"]),
          apply: aggregate.apply.bind(aggregate, command),
        };

        await commandHandler.handler(context);
      }

      const events = await this.eventStore.save(aggregate, command);
      await this.messageBus.publish(events);

      this.eventEmitter.emit("aggregate:success", command, aggregate);

      this.logger.debug("successfully handled command", { command });
    } catch (err) {
      if (err instanceof ConcurrencyError) {
        this.logger.warn("transient concurrency error while handling command", err);
      } else if (err instanceof DomainError) {
        this.logger.warn("domain error while handling command", err);
      } else {
        this.logger.error("failed to handle command", err);
      }

      this.eventEmitter.emit("aggregate:error", err);

      if (err instanceof DomainError && err.permanent) {
        await this.rejectCommand(command, err);
      }

      throw err;
    }
  }

  private async rejectCommand(command: Command, error: ExtendableError): Promise<void> {
    this.logger.debug("rejecting command", { command });

    try {
      await this.messageBus.publish([
        new DomainEvent(
          {
            id: `${command.id}.${error.name}`,
            name: error.name,
            aggregate: command.aggregate,
            data: { error, message: command },
            mandatory: true,
          },
          command,
        ),
      ]);

      this.logger.debug("rejected command", { command });
    } catch (err) {
      this.logger.error("failed to reject command", { command });

      throw err;
    }
  }
}
