import { ConcurrencyError } from "./ConcurrencyError";

export class MongoDuplicateKeyError extends ConcurrencyError {
  constructor(message: string, error: Error) {
    super(message, {
      debug: error,
    });
  }
}
