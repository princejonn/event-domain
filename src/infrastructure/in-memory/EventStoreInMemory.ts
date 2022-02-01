import { Aggregate } from "../../entity";
import { DomainEvent } from "../../message";
import { AggregateIdentifier, IEventStore } from "../../types";
import { cloneDeep, filter, first, last, map, some, union } from "lodash";
import { EventStreamRevisionError } from "../../error";

export class EventStoreInMemory implements IEventStore {
  readonly eventsByAggregate: Record<string, Array<DomainEvent>>;
  readonly saveAttempts: Array<any>;

  constructor() {
    this.eventsByAggregate = {};
    this.saveAttempts = [];
  }

  public async save(events: Array<DomainEvent>, expectedEvents: Array<DomainEvent>): Promise<Array<DomainEvent>> {
    this.saveAttempts.push({ events, expectedEvents });

    const firstAppend = first(events);
    const identifier = Aggregate.identifier(firstAppend.aggregate);
    const stream = this.eventsByAggregate[identifier] || [];
    const streamTail = last(stream);
    const expectedTail = last(expectedEvents);

    if (streamTail?.id !== expectedTail?.id) {
      throw new EventStreamRevisionError(firstAppend.aggregate, streamTail, expectedTail);
    }

    if (!some(stream, { causationId: firstAppend.causationId })) {
      this.eventsByAggregate[identifier] = union(
        stream,
        map(events, (event) => cloneDeep(event)),
      );
    }

    return map(
      filter(this.eventsByAggregate[identifier], { causationId: firstAppend.causationId }),
      (event) => new DomainEvent(event),
    );
  }

  public async load(aggregateIdentifier: AggregateIdentifier): Promise<Array<DomainEvent>> {
    const identifier = Aggregate.identifier(aggregateIdentifier);

    const events = this.eventsByAggregate[identifier];

    return map(events, (event) => cloneDeep(event));
  }
}
