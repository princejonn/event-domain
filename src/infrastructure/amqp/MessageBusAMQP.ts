import amqp, { ConfirmChannel, Connection, ConsumeMessage, Options } from "amqplib";
import { DomainEvent, Command, Message, Timeout } from "../../message";
import {
  IMessageBus,
  MessageBusOptionalOptions,
  Subscription,
  SubscriptionObject,
} from "../../types";
import { Logger } from "@lindorm-io/winston";
import { MessageType } from "../../enum";
import { merge } from "lodash";

const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));

export class MessageBusAMQP implements IMessageBus {
  private readonly amqp: Options.Connect;
  private readonly options: MessageBusOptionalOptions;
  private readonly subscriptions: Array<Subscription>;
  private channel: ConfirmChannel;
  private connection: Connection;
  private logger: Logger;
  private promise: Promise<void>;

  constructor(logger: Logger, amqp: Options.Connect, options: MessageBusOptionalOptions) {
    this.logger = logger.createChildLogger(["MessageBusAMQP"]);

    this.amqp = merge(
      {
        heartbeat: 10,
      },
      amqp,
    );
    this.options = merge(
      {
        exchange: "domain",
        deadLetters: "deadletters",
        reconnectTimeout: 1000,
        retryTimeout: 1000,
      },
      options,
    );
    this.subscriptions = [];

    this.promise = this.connect();
  }

  public async publish(messages: Array<Message>): Promise<void> {
    this.logger.debug("[publish] init", { messages });

    await this.promise;

    for (const message of messages) {
      await this.handleMessage(message);
    }

    this.logger.debug("[publish] success", { messages });
  }

  public async subscribe(subscription: Subscription): Promise<void> {
    this.logger.debug("[subscribe] init", { subscription });

    await this.promise;

    await this.handleSubscription(subscription);
    this.subscriptions.push(subscription);

    this.logger.debug("[subscribe] success", { subscription });
  }

  public async close(): Promise<void> {
    await this.promise;
    await this.channel.close();
    await this.connection.close();
  }

  private async connect(): Promise<void> {
    this.logger.verbose("[connect] init", { amqp: this.amqp, options: this.options });

    this.connection = await this.connectWithRetry();
    this.handleConnectionEvents();

    this.channel = await this.connection.createConfirmChannel();
    this.handleChannelEvents();

    await this.channel.assertExchange(this.options.exchange, "topic", { durable: true });
    await this.bindQueue(this.options.deadLetters, this.options.deadLetters);

    for (const subscription of this.subscriptions) {
      await this.handleSubscription(subscription);
    }

    this.logger.verbose("[connect] success", { options: this.options });
  }

  private async connectWithRetry(): Promise<Connection> {
    this.logger.verbose("[connectWithRetry] init", { options: this.options });

    try {
      return await amqp.connect(this.amqp);
    } catch (err) {
      this.logger.error("connection refused", err);

      await sleep(this.options.reconnectTimeout);

      return this.connectWithRetry();
    }
  }

  private handleConnectionEvents(): void {
    this.connection.on("error", (err) => {
      this.logger.warn("recovering broken connection", err);
      this.promise = this.connect();
    });
  }

  private handleChannelEvents(): void {
    this.channel.on("return", (msg) => {
      const content = JSON.parse(msg.content.toString());
      this.channel.publish(
        this.options.exchange,
        this.options.deadLetters,
        msg.content,
        {
          persistent: true,
          mandatory: content.mandatory === true,
        },
        (err) => {
          if (err) {
            this.logger.error("failed to deadletter returned message", {
              error: err,
              message: content,
            });
          } else {
            this.logger.warn("deadlettered returned message");
          }
        },
      );
    });
  }

  private async bindQueue(
    queue: string,
    routingKey: string,
    options?: Options.AssertQueue,
  ): Promise<void> {
    this.logger.debug("[bindQueue] init", { queue, routingKey, options });

    await this.channel.assertQueue(
      queue,
      merge(
        {
          durable: true,
        },
        options,
      ),
    );

    await this.channel.bindQueue(queue, this.options.exchange, routingKey);

    this.logger.debug("[bindQueue] success", { queue, routingKey, options });
  }

  private async handleSubscription(subscription: Subscription): Promise<void> {
    this.logger.debug("[handleSubscription] init", { subscription });

    const queue = MessageBusAMQP.sanitizeName(subscription.sub);
    const routingKey = MessageBusAMQP.sanitizeName(subscription.topic);

    await this.bindQueue(queue, routingKey, {
      deadLetterExchange: this.options.exchange,
      deadLetterRoutingKey: this.options.deadLetters,
    });

    await this.channel.consume(queue, (msg) => {
      const message = MessageBusAMQP.convertMessage(msg);

      this.logger.debug("consuming message", {
        subscription,
        queue,
        routingKey,
        message,
      });

      return subscription
        .callback(message)
        .then(
          () => {
            this.logger.debug("ack message", { message });
            this.channel.ack(msg);
          },
          (): Promise<void> =>
            new Promise((resolve, reject) => {
              setTimeout(() => {
                try {
                  this.logger.debug("nack message", { message });
                  this.channel.nack(msg, false, true);
                  resolve();
                } catch (err) {
                  reject(err);
                }
              }, this.options.retryTimeout);
            }),
        )
        .catch((err: Error) => {
          this.logger.error("failed to ack/nack message", err);
        });
    });

    this.logger.debug("[handleSubscription] success", {
      subscription,
      queue,
      routingKey,
    });
  }

  private async handleMessage(message: Message): Promise<void> {
    this.logger.debug("[handleMessage] init", { message });

    const routingKey = MessageBusAMQP.sanitizeName(message);
    const delayQueue = `${routingKey}.delayed`;

    if (message.delay > 0) {
      this.logger.debug("[handleMessage] publish with delay", {
        message,
        routingKey,
        delayQueue,
      });

      await this.assertDelayedQueue(delayQueue, routingKey);

      this.channel.publish("", delayQueue, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        mandatory: message.mandatory === true,
        expiration: message.delay,
      });
    } else {
      this.logger.debug("[handleMessage] publish", { message, routingKey });

      this.channel.publish(
        this.options.exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          mandatory: message.mandatory === true,
        },
      );
    }

    this.logger.debug("[handleMessage] success", { message, routingKey, delayQueue });
  }

  private async assertDelayedQueue(queue: string, routingKey: string): Promise<void> {
    await this.channel.assertQueue(queue, {
      durable: true,
      deadLetterExchange: this.options.exchange,
      deadLetterRoutingKey: routingKey,
    });
  }

  static sanitizeName(msg: SubscriptionObject): string {
    return `${msg.aggregate.context}.${msg.aggregate.name}.${msg.name}`.replace(
      /[^a-z0-9-_:.]/gi,
      "",
    );
  }

  static convertMessage(msg: ConsumeMessage): DomainEvent | Command {
    const content = JSON.parse(msg.content.toString());

    switch (content.type) {
      case MessageType.COMMAND:
        return new Command(content);

      case MessageType.EVENT:
        return new DomainEvent(content);

      case MessageType.TIMEOUT:
        return new Timeout(content);

      case MessageType.UNKNOWN:
        return content;
    }
  }
}
