import { ConcurrencyError } from "./ConcurrencyError";
import { DomainEvent } from "../message";
import { AggregateIdentifier } from "../types";

export class EventStreamRevisionError extends ConcurrencyError {
  constructor(aggregateIdentifier: AggregateIdentifier, streamTail: DomainEvent, expectedTail: DomainEvent) {
    super("Event Stream is at a different revision", {
      debug: {
        aggregateIdentifier,
        streamTail: { id: streamTail?.id },
        expectedTail: { id: expectedTail?.id },
      },
    });
  }
}
