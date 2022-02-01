import { ConcurrencyError } from "./ConcurrencyError";

export class SagaNotInStoreError extends ConcurrencyError {
  constructor() {
    super("Saga does not exist in store");
  }
}
