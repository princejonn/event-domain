import {
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  ISagaEventHandler,
  SagaEventHandlerContext,
  SagaEventHandlerOptions,
  SagaStoreSaveOptions,
  GetSagaIdFunction,
} from "../types";

export class SagaEventHandler<State> implements ISagaEventHandler<State> {
  readonly aggregate: HandlerIdentifierMultipleContexts;
  readonly conditions: HandlerConditions;
  readonly eventName: string;
  readonly getSagaId: GetSagaIdFunction;
  readonly saga: HandlerIdentifier;
  readonly saveOptions: SagaStoreSaveOptions;
  readonly handler: (context: SagaEventHandlerContext<State>) => Promise<void>;

  constructor(options: SagaEventHandlerOptions<State>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.conditions = options.conditions || {};
    this.eventName = options.eventName;
    this.getSagaId = options.getSagaId;
    this.saga = { name: options.saga?.name, context: options.saga?.context };
    this.saveOptions = options.saveOptions || {};
    this.handler = options.handler;
  }
}
