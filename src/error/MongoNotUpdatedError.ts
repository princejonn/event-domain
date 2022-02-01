import { ConcurrencyError } from "./ConcurrencyError";

export class MongoNotUpdatedError extends ConcurrencyError {
  constructor(filter: Record<string, unknown>, update: Record<string, unknown>) {
    super("Field was not updated", { debug: { filter, update } });
  }
}
