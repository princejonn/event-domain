import { AggregateCommandHandler, AggregateEventHandler } from "../handler";
import { EventStoreOptions } from "./event-store";
import { MessageBusOptions } from "./message-bus";
import { Logger } from "@lindorm-io/winston";
import { EventEmitterCallback, EventType } from "./event-emitter";

export interface IAggregateDomain<State> {
  on(evt: EventType, callback: EventEmitterCallback<State>): void;
  registerCommandHandler(handler: AggregateCommandHandler<State>): Promise<void>;
  registerEventHandler(handler: AggregateEventHandler<State>): Promise<void>;
}

export interface AggregateDomainOptions {
  eventStore: EventStoreOptions;
  messageBus: MessageBusOptions;
  logger: Logger;
}
