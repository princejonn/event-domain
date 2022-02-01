import { LindormError, LindormErrorOptions } from "@lindorm-io/errors";

export abstract class ConcurrencyError extends LindormError {
  protected constructor(message: string, options?: LindormErrorOptions) {
    super(message, options);
  }
}
