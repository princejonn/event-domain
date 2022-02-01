import { ConcurrencyError } from "./ConcurrencyError";
import { Saga } from "../entity";

export class SagaRevisionError extends ConcurrencyError {
  constructor(saga: Saga<any>, existingRevision: number) {
    super("Saga is at an unexpected revision", {
      debug: {
        saga: Saga.identifier(saga),
        expect: saga.revision,
        actual: existingRevision,
      },
    });
  }
}
