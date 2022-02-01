import { AnyType, GenericRecord } from "./generic";
import { DomainEvent } from "../message";
import { Logger } from "@lindorm-io/winston";
import { ViewStoreCollectionOptions } from "./view-store";
import {
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierExpectingStructure,
  HandlerIdentifierMultipleContexts,
} from "./handler";

export interface IViewEventHandler<State> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  eventName: string;
  getViewId: GetViewIdFunction;
  loadOptions: ViewStoreCollectionOptions<State>;
  saveOptions: ViewStoreCollectionOptions<State>;
  view: HandlerIdentifier;
  handler(context: ViewEventHandlerContext<State>): Promise<void>;
}

export interface ViewEventHandlerOptions<State> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions?: HandlerConditions;
  eventName: string;
  getViewId: GetViewIdFunction;
  loadOptions?: ViewStoreCollectionOptions<State>;
  saveOptions?: ViewStoreCollectionOptions<State>;
  view?: HandlerIdentifierExpectingStructure;
  handler(context: ViewEventHandlerContext<State>): Promise<void>;
}

export type GetViewIdFunction = (event: DomainEvent) => string;

export interface ViewEventHandlerContext<State> {
  event: DomainEvent;
  state: GenericRecord<State>;
  logger: Logger;
  addField(path: string, value: AnyType): void;
  destroy(): void;
  removeFieldWhereEqual(path: string, value: AnyType): void;
  removeFieldWhereMatch(path: string, value: Record<string, any>): void;
  setState(path: string, value: AnyType): void;
}
