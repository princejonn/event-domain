import { DomainError } from "./DomainError";

export class AggregateNotDestroyedError extends DomainError {
  constructor() {
    super("Aggregate has not been destroyed", { permanent: true });
  }
}
