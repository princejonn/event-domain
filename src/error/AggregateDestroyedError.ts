import { DomainError } from "./DomainError";

export class AggregateDestroyedError extends DomainError {
  constructor() {
    super("Aggregate is destroyed", { permanent: true });
  }
}
