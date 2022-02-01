import { AggregateIdentifier } from "./aggregate";
import { MessageType } from "../enum";

export interface IMessage {
  aggregate: AggregateIdentifier;
  causationId: string;
  correlationId: string;
  data: Record<string, any>;
  delay: number;
  id: string;
  mandatory: boolean;
  name: string;
  timestamp: Date;
  type: MessageType;
}

export interface MessageOptions {
  aggregate: AggregateIdentifier;
  causationId?: string;
  correlationId?: string;
  data?: Record<string, any>;
  delay?: number;
  id?: string;
  mandatory?: boolean;
  name: string;
  timestamp?: Date | string;
  type?: MessageType;
}
