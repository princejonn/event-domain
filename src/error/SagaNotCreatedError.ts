import { DomainError } from "./DomainError";

export class SagaNotCreatedError extends DomainError {
  constructor(permanent = false) {
    super("Saga has not been created", { permanent });
  }
}
