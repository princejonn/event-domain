import { LindormError } from "@lindorm-io/errors";

export class CausationMissingEventsError extends LindormError {
  constructor() {
    super("Causation produces no event array in aggregate");
  }
}
