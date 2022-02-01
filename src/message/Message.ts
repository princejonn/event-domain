import { AggregateIdentifier, IMessage, MessageOptions } from "../types";
import { MessageType } from "../enum";
import { isString } from "lodash";
import { parseISO } from "date-fns";
import { randomUUID } from "crypto";

export abstract class Message implements IMessage {
  readonly id: string;
  readonly name: string;
  readonly type: MessageType;

  readonly aggregate: AggregateIdentifier;
  readonly causationId: string;
  readonly correlationId: string;
  readonly data: Record<string, any>;
  readonly delay: number;
  readonly mandatory: boolean;
  readonly timestamp: Date;

  protected constructor(options: MessageOptions, causation?: IMessage) {
    this.id = options.id || randomUUID();
    this.name = options.name;
    this.type = options.type || MessageType.UNKNOWN;

    this.aggregate = options.aggregate;
    this.causationId = options.causationId || causation?.id || this.id;
    this.correlationId = options.correlationId || causation?.correlationId || randomUUID();
    this.data = options.data || {};
    this.delay = options.delay || 0;
    this.mandatory = options.mandatory || false;

    const timestamp = options.timestamp || new Date();
    this.timestamp = isString(timestamp) ? parseISO(timestamp) : timestamp;
  }
}
