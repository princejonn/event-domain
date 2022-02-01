import {
  IAggregateEventHandler,
  AggregateEventHandlerContext,
  AggregateEventHandlerOptions,
  HandlerIdentifier,
} from "../types";

export class AggregateEventHandler<State> implements IAggregateEventHandler<State> {
  readonly aggregate: HandlerIdentifier;
  readonly eventName: string;
  readonly handler: (context: AggregateEventHandlerContext<State>) => Promise<void>;

  constructor(options: AggregateEventHandlerOptions<State>) {
    this.aggregate = { name: options.aggregate?.name, context: options.aggregate?.context };
    this.eventName = options.eventName || null;
    this.handler = options.handler;
  }
}
