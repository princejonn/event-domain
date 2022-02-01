import { EventEmitterCallback, EventType } from "./event-emitter";
import { Logger } from "@lindorm-io/winston";
import { MessageBusOptions } from "./message-bus";
import { View } from "../entity";
import { ViewEventHandler } from "../handler";
import { ViewStoreQuery, ViewStoreOptions } from "./view-store";

export interface IViewDomain<State> {
  on(evt: EventType, callback: EventEmitterCallback<State>): void;
  query(query: ViewStoreQuery): Promise<Array<View<State>>>;
  registerEventHandler(eventHandler: ViewEventHandler<State>): Promise<void>;
}

export interface ViewDomainOptions {
  viewStore: ViewStoreOptions;
  messageBus: MessageBusOptions;
  logger: Logger;
}
