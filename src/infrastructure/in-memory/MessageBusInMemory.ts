import { IMessageBus, Subscription } from "../../types";
import { Message } from "../../message";
import { filter } from "lodash";

const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));

export class MessageBusInMemory implements IMessageBus {
  public subscriptions: Array<Subscription>;
  public published: Array<Message>;

  constructor() {
    this.subscriptions = [];
    this.published = [];
  }

  public async clear(): Promise<void> {
    this.subscriptions = [];
    this.published = [];
  }

  public async publish(messages: Array<Message>): Promise<void> {
    for (const message of messages) {
      const subscriptions = filter(this.subscriptions, {
        topic: {
          name: message.name,
          aggregate: {
            name: message.aggregate.name,
            context: message.aggregate.context,
          },
        },
      });

      for (const subscription of subscriptions) {
        await this.handle(message, subscription, message.delay);
      }

      this.published.push(message);
    }
  }

  public async subscribe(subscription: Subscription): Promise<void> {
    this.subscriptions.push(subscription);
  }

  private async handle(message: Message, subscription: Subscription, delay?: number) {
    await sleep(delay);

    try {
      await subscription.callback(message);
    } catch (err) {
      await this.handle(message, subscription);
      throw err;
    }
  }
}
