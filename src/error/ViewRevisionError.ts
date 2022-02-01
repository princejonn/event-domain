import { ConcurrencyError } from "./ConcurrencyError";
import { View } from "../entity";

export class ViewRevisionError extends ConcurrencyError {
  constructor(view: View<any>, existingRevision: number) {
    super("View is at an unexpected revision", {
      debug: {
        view: View.identifier(view),
        expect: view.revision,
        actual: existingRevision,
      },
    });
  }
}
