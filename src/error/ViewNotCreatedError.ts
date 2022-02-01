import { DomainError } from "./DomainError";

export class ViewNotCreatedError extends DomainError {
  constructor(permanent = false) {
    super("View has not been created", { permanent });
  }
}
