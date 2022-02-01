import Joi from "joi";
import { Command } from "../message";
import { GenericRecord } from "./generic";
import { Logger } from "@lindorm-io/winston";
import {
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierExpectingStructure,
} from "./handler";

export interface IAggregateCommandHandler<State> {
  aggregate: HandlerIdentifier;
  commandName: string;
  conditions: HandlerConditions;
  schema: Joi.Schema;
  handler(context: AggregateCommandHandlerContext<State>): Promise<void>;
}

export interface AggregateCommandHandlerOptions<State> {
  aggregate?: HandlerIdentifierExpectingStructure;
  commandName?: string;
  conditions?: HandlerConditions;
  schema: Joi.Schema;
  handler(context: AggregateCommandHandlerContext<State>): Promise<void>;
}

export interface AggregateCommandHandlerContext<State> {
  command: Command;
  state: GenericRecord<State>;
  logger: Logger;
  apply(name: string, data?: Record<string, any>): Promise<void>;
}
