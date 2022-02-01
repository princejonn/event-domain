import { IMessageBus, MessageBusOptions, Subscription } from "../types";
import { Logger } from "@lindorm-io/winston";
import { Message } from "../message";
import { MessageBusInMemory } from "./in-memory";
import { MessageBusType } from "../enum";
import { PUBLISH_SCHEMA, SUBSCRIBE_SCHEMA } from "../schema";
import { validateSchemaAsync } from "../util";
import { MessageBusAMQP } from "./amqp";

export class MessageBus {
  private readonly logger: Logger;
  private messageBus: IMessageBus;

  constructor(logger: Logger, options?: MessageBusOptions) {
    this.logger = logger.createChildLogger(["MessageBus"]);

    const type = options?.type || MessageBusType.MEMORY;

    switch (type) {
      case MessageBusType.AMQP:
        this.messageBus = new MessageBusAMQP(this.logger, options.amqp, options.options);
        break;

      case MessageBusType.CUSTOM:
        this.messageBus = options.custom;
        break;

      case MessageBusType.MEMORY:
        this.messageBus = new MessageBusInMemory();
        break;

      default:
        throw new Error("Invalid message bus type");
    }
  }

  async publish(messages: Array<Message>): Promise<void> {
    this.logger.debug("publish messages", { messages });

    await validateSchemaAsync(PUBLISH_SCHEMA, { messages });

    await this.messageBus.publish(messages);
  }

  async subscribe(subscription: Subscription): Promise<void> {
    this.logger.debug("add subscription", { subscription });

    await validateSchemaAsync(SUBSCRIBE_SCHEMA, { subscription });

    await this.messageBus.subscribe(subscription);
  }
}
