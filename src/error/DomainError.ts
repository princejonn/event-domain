import { LindormError } from "@lindorm-io/errors";
import { DomainErrorOptions } from "../types";

export abstract class DomainError extends LindormError {
  readonly permanent: boolean;

  protected constructor(message: string, options?: DomainErrorOptions) {
    super(message, options);

    this.permanent = options.permanent || false;
  }
}
