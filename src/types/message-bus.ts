import { HandlerIdentifier } from "./handler";
import { Message } from "../message";
import { Options } from "amqplib";
import { MessageBusType } from "../enum";

export interface Subscription {
  callback(message: Message): Promise<void>;
  sub: SubscriptionObject;
  topic: SubscriptionObject;
}

export interface SubscriptionObject {
  name: string;
  aggregate: HandlerIdentifier;
  handler?(context: any): void;
}

export interface IMessageBus {
  publish(messages: Array<Message>): Promise<void>;
  subscribe(subscription: Subscription): Promise<void>;
}

export interface MessageBusOptions {
  amqp?: Options.Connect;
  custom?: IMessageBus;
  options?: MessageBusOptionalOptions;
  type?: MessageBusType;
}

export interface MessageBusOptionalOptions {
  deadLetters: string;
  exchange: string;
  reconnectTimeout: number;
  retryTimeout: number;
}
