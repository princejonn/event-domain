import { DomainError } from "./DomainError";

export class AggregateAlreadyCreatedError extends DomainError {
  constructor() {
    super("Aggregate has already been created", { permanent: true });
  }
}
