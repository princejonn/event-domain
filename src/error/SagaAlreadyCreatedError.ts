import { DomainError } from "./DomainError";

export class SagaAlreadyCreatedError extends DomainError {
  constructor(permanent = false) {
    super("Saga has already been created", { permanent });
  }
}
