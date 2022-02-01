import { LindormError } from "@lindorm-io/errors";

export class HandlerNotRegisteredError extends LindormError {
  constructor() {
    super("Handler has not been registered");
  }
}
