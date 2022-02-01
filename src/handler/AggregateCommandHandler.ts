import Joi from "joi";
import {
  IAggregateCommandHandler,
  AggregateCommandHandlerContext,
  AggregateCommandHandlerOptions,
  HandlerConditions,
  HandlerIdentifier,
} from "../types";

export class AggregateCommandHandler<State> implements IAggregateCommandHandler<State> {
  readonly aggregate: HandlerIdentifier;
  readonly commandName: string;
  readonly conditions: HandlerConditions;
  readonly schema: Joi.Schema;
  readonly handler: (context: AggregateCommandHandlerContext<State>) => Promise<void>;

  constructor(options: AggregateCommandHandlerOptions<State>) {
    this.aggregate = { name: options.aggregate?.name, context: options.aggregate?.context };
    this.commandName = options.commandName || null;
    this.conditions = options.conditions || {};
    this.schema = options.schema;
    this.handler = options.handler;
  }
}
