import { Aggregate } from "../entity";
import { AggregateEventHandler } from "../handler";
import { CausationMissingEventsError } from "../error";
import { Command, DomainEvent } from "../message";
import { EventStoreInMemory } from "./in-memory";
import { EventStoreMongo } from "./mongo";
import { AggregateIdentifier, IEventStore, EventStoreOptions } from "../types";
import { Logger } from "@lindorm-io/winston";
import { StoreType } from "../enum";
import { CAUSATION_EVENTS_SCHEMA, SAVE_AGGREGATE_SCHEMA } from "../schema";
import { filter, take } from "lodash";
import { validateSchemaAsync } from "../util";

export class EventStore<State> {
  private readonly logger: Logger;
  private eventStore: IEventStore;

  constructor(logger: Logger, options?: EventStoreOptions) {
    this.logger = logger.createChildLogger(["EventStore"]);

    const type = options?.type || StoreType.MEMORY;

    switch (type) {
      case StoreType.CUSTOM:
        this.eventStore = options.custom;
        break;

      case StoreType.MEMORY:
        this.eventStore = new EventStoreInMemory();
        break;

      case StoreType.MONGO:
        this.eventStore = new EventStoreMongo(this.logger, options.mongo);
        break;

      default:
        throw new Error("Invalid Store Type");
    }
  }

  public async save(
    aggregate: Aggregate<State>,
    causation: Command,
  ): Promise<Array<DomainEvent>> {
    this.logger.debug("save aggregate events to store", {
      aggregate: {
        destroyed: aggregate.destroyed,
        events: aggregate.events,
        loaded: aggregate.numberOfLoadedEvents,
        state: aggregate.state,
      },
      causation,
    });

    await validateSchemaAsync(SAVE_AGGREGATE_SCHEMA, {
      aggregate,
      causation,
      events: aggregate.events,
    });

    const causationEvents = filter(
      aggregate.events,
      (event) => event.causationId === causation.id,
    );
    const expectedEvents = take(aggregate.events, aggregate.numberOfLoadedEvents);

    await validateSchemaAsync(CAUSATION_EVENTS_SCHEMA, { causationEvents });

    if (causationEvents.length === 0) {
      throw new CausationMissingEventsError();
    }

    return await this.eventStore.save(causationEvents, expectedEvents);
  }

  public async load(
    aggregateIdentifier: AggregateIdentifier,
    eventHandlers: Array<AggregateEventHandler<State>>,
  ): Promise<Aggregate<State>> {
    this.logger.debug("load aggregate events from store", {
      aggregateIdentifier,
      eventHandlers,
    });

    const events = await this.eventStore.load(aggregateIdentifier);
    const aggregate = new Aggregate(
      {
        id: aggregateIdentifier.id,
        name: aggregateIdentifier.name,
        context: aggregateIdentifier.context,
        eventHandlers: eventHandlers,
      },
      this.logger,
    );

    for (const event of events) {
      await aggregate.load(event);
    }

    return aggregate;
  }
}
