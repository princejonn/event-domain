import { DomainError } from "./DomainError";

export class ViewAlreadyCreatedError extends DomainError {
  constructor(permanent = false) {
    super("View has already been created", { permanent });
  }
}
