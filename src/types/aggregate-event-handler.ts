import { AnyType, GenericRecord } from "./generic";
import { DomainEvent } from "../message";
import { HandlerIdentifier, HandlerIdentifierExpectingStructure } from "./handler";
import { Logger } from "@lindorm-io/winston";

export interface IAggregateEventHandler<State> {
  eventName: string;
  aggregate: HandlerIdentifier;
  handler(context: AggregateEventHandlerContext<State>): Promise<void>;
}

export interface AggregateEventHandlerOptions<State> {
  eventName?: string;
  aggregate?: HandlerIdentifierExpectingStructure;
  handler(context: AggregateEventHandlerContext<State>): Promise<void>;
}

export interface AggregateEventHandlerContext<State> {
  event: DomainEvent;
  state: GenericRecord<State>;
  logger: Logger;
  destroy(): void;
  destroyNext(): void;
  mergeState(data: Record<string, any>): void;
  setState(path: string, value: AnyType): void;
}
