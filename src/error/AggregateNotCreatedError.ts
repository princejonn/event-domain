import { DomainError } from "./DomainError";

export class AggregateNotCreatedError extends DomainError {
  constructor() {
    super("Aggregate has not been created", { permanent: true });
  }
}
