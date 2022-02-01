import { Aggregate, Saga, View } from "../src/entity";
import { App, Command, LogLevel, Logger, MessageBusType, StoreType, DomainEvent } from "../src";
import { MongoOptions } from "../src/types";
import { join } from "path";
import { randomUUID } from "crypto";

const logger = new Logger();

const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));

(async () => {
  logger.addConsole(LogLevel.INFO, { colours: true, readable: true, timestamp: true });

  const mongo: MongoOptions = {
    host: "localhost",
    port: 27017,
    auth: {
      username: "root",
      password: "example",
    },
  };
  const amqp = {
    hostname: "localhost",
    port: 5672,
  };

  try {
    const app = new App({
      logger: logger,
      domain: {
        directory: join(__dirname),
      },
      messageBus: {
        type: MessageBusType.AMQP,
        amqp: amqp,
      },
      eventStore: {
        type: StoreType.MONGO,
        mongo: mongo,
      },
      sagaStore: {
        type: StoreType.MONGO,
        mongo: mongo,
      },
      viewStore: {
        type: StoreType.MONGO,
        mongo: mongo,
      },
    });

    app.on("aggregate:success", (command: Command, aggregate: Aggregate<any>) => {
      logger.info("aggregate:success", { command, aggregate });
    });
    app.on("saga:success", (event: DomainEvent, saga: Saga<any>) => {
      logger.info("saga:success", { event, saga });
    });
    app.on("view:success", (event: DomainEvent, view: View<any>) => {
      logger.info("view:success", { event, view });
    });

    app.on("aggregate:error", (error: Error) => {
      logger.info("aggregate:error", { error });
    });
    app.on("saga:error", (error: Error) => {
      logger.info("saga:error", { error });
    });
    app.on("view:error", (error: Error) => {
      logger.info("view:error", { error });
    });

    const guid = randomUUID();

    await app.publish(
      new Command({
        name: "create",
        aggregate: {
          id: guid,
          name: "greeting",
          context: "default",
        },
        data: { hello: "world" },
      }),
    );

    await sleep(3000);

    const result = await app.query({
      id: guid,
      name: "greeting",
      context: "default",
    });

    logger.info("query", { result });
  } catch (err) {
    logger.error("error", err);
  } finally {
    process.exit(0);
  }
})();
