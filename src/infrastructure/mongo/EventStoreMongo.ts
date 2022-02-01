import { DomainEvent } from "../../message";
import { EventField, EventStoreField } from "../../enum";
import {
  AggregateIdentifier,
  IEventStore,
  MongoOptions,
  MongoConnectionOptions,
} from "../../types";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "./MongoConnection";
import { MongoDuplicateKeyError } from "../../error";
import { first, flatten, last, map, merge } from "lodash";
import { OptionalUnlessRequiredId } from "mongodb";

export class EventStoreMongo implements IEventStore {
  private readonly logger: Logger;
  private readonly options: MongoConnectionOptions;

  constructor(logger: Logger, options: MongoOptions) {
    this.logger = logger.createChildLogger(["EventStoreMongo"]);

    this.options = merge(
      {
        collectionName: "events",
        databaseName: "event_domain",
        indices: [
          {
            index: {
              [`${[EventStoreField.PATH]}.id`]: 1,
              [`${[EventStoreField.PATH]}.name`]: 1,
              [`${[EventStoreField.PATH]}.context`]: 1,
              [EventStoreField.CAUSATION_ID]: 1,
            },
            options: {
              name: "unique_causation",
              unique: true,
            },
          },
          {
            index: {
              [`${[EventStoreField.PATH]}.id`]: 1,
              [`${[EventStoreField.PATH]}.name`]: 1,
              [`${[EventStoreField.PATH]}.context`]: 1,
              [EventStoreField.REVISION]: 1,
            },
            options: {
              name: "unique_revision",
              unique: true,
            },
          },
          {
            index: {
              [`${[EventStoreField.PATH]}.id`]: 1,
              [`${[EventStoreField.PATH]}.name`]: 1,
              [`${[EventStoreField.PATH]}.context`]: 1,
              [EventStoreField.LOAD_EVENTS]: 1,
            },
            options: {
              name: "load_events",
              unique: true,
            },
          },
        ],
        winston: this.logger,
      },
      options,
    );
  }

  public async save(
    causationEvents: Array<DomainEvent>,
    expectedEvents: Array<DomainEvent>,
  ): Promise<Array<DomainEvent>> {
    this.logger.debug("save initialised", { causationEvents, expectedEvents });

    const firstNewEvent = first(causationEvents);
    const lastExpectedEvent = last(expectedEvents);
    const aggregateIdentifier = firstNewEvent.aggregate;

    const connection = new MongoConnection(this.options);

    try {
      const collection = await connection.connect();

      const cursor = await collection.find(
        {
          [EventStoreField.CAUSATION_ID]: firstNewEvent.causationId,
          [EventStoreField.PATH]: {
            id: aggregateIdentifier.id,
            name: aggregateIdentifier.name,
            context: aggregateIdentifier.context,
          },
        },
        {
          limit: 1,
          projection: { [EventStoreField.EVENTS]: 1 },
        },
      );
      const docs = await cursor.toArray();

      if (docs.length) {
        const list = flatten(map(docs, (doc) => doc[EventStoreField.EVENTS]));
        const events = EventStoreMongo.mapEvents(aggregateIdentifier, list);

        this.logger.debug("documents already found", { events });

        return events;
      }

      const json: OptionalUnlessRequiredId<any> = {
        [EventStoreField.CAUSATION_ID]: firstNewEvent.causationId,
        [EventStoreField.EVENTS]: map(causationEvents, (event) => ({
          [EventField.ID]: event.id,
          [EventField.NAME]: event.name,
          [EventField.CAUSATION_ID]: event.causationId,
          [EventField.CORRELATION_ID]: event.correlationId,
          [EventField.DATA]: event.data,
          [EventField.TIMESTAMP]: event.timestamp,
        })),
        [EventStoreField.LOAD_EVENTS]: expectedEvents.length,
        [EventStoreField.PATH]: aggregateIdentifier,
        [EventStoreField.REVISION]: lastExpectedEvent ? lastExpectedEvent.id : null,
        [EventStoreField.TIMESTAMP]: new Date(),
      };

      const result = await collection.insertOne(json);

      this.logger.debug("document inserted", {
        json,
        acknowledged: result.acknowledged,
        insertedId: result.insertedId,
      });

      return causationEvents;
    } catch (err) {
      this.logger.error("error", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    } finally {
      await connection.disconnect();
    }
  }

  public async load(
    aggregateIdentifier: AggregateIdentifier,
  ): Promise<Array<DomainEvent>> {
    this.logger.debug("load initialised", { aggregateIdentifier });

    const connection = new MongoConnection(this.options);

    try {
      const collection = await connection.connect();

      const cursor = await collection.find(
        {
          [EventStoreField.PATH]: {
            id: aggregateIdentifier.id,
            name: aggregateIdentifier.name,
            context: aggregateIdentifier.context,
          },
        },
        { sort: { [EventStoreField.LOAD_EVENTS]: 1 } },
      );

      const docs = await cursor.toArray();
      const list = flatten(map(docs, (doc) => doc[EventStoreField.EVENTS]));
      const events = EventStoreMongo.mapEvents(aggregateIdentifier, list);

      this.logger.debug("load successful", { events });

      return events;
    } catch (err) {
      this.logger.error("error", err);

      throw err;
    } finally {
      await connection.disconnect();
    }
  }

  static mapEvents(
    aggregateIdentifier: AggregateIdentifier,
    events: Array<Record<EventField, any>>,
  ): Array<DomainEvent> {
    return map(
      events,
      (data) =>
        new DomainEvent({
          id: data[EventField.ID],
          name: data[EventField.NAME],
          aggregate: {
            id: aggregateIdentifier.id,
            name: aggregateIdentifier.name,
            context: aggregateIdentifier.context,
          },
          causationId: data[EventField.CAUSATION_ID],
          correlationId: data[EventField.CORRELATION_ID],
          data: data[EventField.DATA],
          timestamp: new Date(data[EventField.TIMESTAMP]),
        }),
    );
  }
}
