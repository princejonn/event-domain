import { DomainError } from "./DomainError";

export class CommandSchemaValidationError extends DomainError {
  constructor(joiError: Error) {
    super("Command schema validation error", {
      debug: {
        joiError,
      },
      permanent: true,
    });
  }
}
