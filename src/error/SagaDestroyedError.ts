import { DomainError } from "./DomainError";

export class SagaDestroyedError extends DomainError {
  constructor() {
    super("Saga is destroyed", { permanent: true });
  }
}
