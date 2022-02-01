import { AnyType, GenericRecord } from "./generic";
import { Command, DomainEvent } from "../message";
import { Logger } from "@lindorm-io/winston";
import { SagaStoreSaveOptions } from "./saga-store";
import {
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierExpectingStructure,
  HandlerIdentifierMultipleContexts,
} from "./handler";

export interface ISagaEventHandler<State> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  eventName: string;
  getSagaId: GetSagaIdFunction;
  saga: HandlerIdentifier;
  saveOptions: SagaStoreSaveOptions;
  handler(context: SagaEventHandlerContext<State>): Promise<void>;
}

export interface SagaEventHandlerOptions<State> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions?: HandlerConditions;
  eventName: string;
  getSagaId: GetSagaIdFunction;
  saga?: HandlerIdentifierExpectingStructure;
  saveOptions?: SagaStoreSaveOptions;
  handler(context: SagaEventHandlerContext<State>): Promise<void>;
}

export interface SagaEventHandlerContext<State> {
  event: DomainEvent;
  state: GenericRecord<State>;
  logger: Logger;
  destroy(): void;
  dispatch(command: Command): void;
  mergeState(data: Record<string, any>): void;
  setState(path: string, value: AnyType): void;
  timeout(name: string, data: Record<string, any>, delay: number): void;
}

export type GetSagaIdFunction = (event: DomainEvent) => string;
