import { DomainError } from "./DomainError";

export class ViewDestroyedError extends DomainError {
  constructor() {
    super("View is destroyed", { permanent: true });
  }
}
