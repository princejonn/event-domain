import { MessageBusOptions } from "./message-bus";
import { SagaStoreOptions } from "./saga-store";
import { Logger } from "@lindorm-io/winston";
import { SagaEventHandler } from "../handler";
import { EventEmitterCallback, EventType } from "./event-emitter";

export interface ISagaDomain<State> {
  on(evt: EventType, callback: EventEmitterCallback<State>): void;
  registerEventHandler(eventHandler: SagaEventHandler<State>): void;
}

export interface SagaDomainOptions {
  sagaStore: SagaStoreOptions;
  messageBus: MessageBusOptions;
  logger: Logger;
}
