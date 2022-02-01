import { ConcurrencyError } from "./ConcurrencyError";
import { Saga } from "../entity";

export class SagaCausationError extends ConcurrencyError {
  constructor(saga: Saga<any>, causationId: string) {
    super("Causation already exists in list", {
      debug: {
        saga: Saga.identifier(saga),
        causationList: saga.causationList,
        causation: causationId,
      },
    });
  }
}
