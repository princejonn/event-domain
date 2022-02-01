import { ConcurrencyError } from "./ConcurrencyError";
import { View } from "../entity";

export class ViewCausationError extends ConcurrencyError {
  constructor(view: View<any>, causationId: string) {
    super("Causation already exists in list", {
      debug: {
        view: View.identifier(view),
        causationList: view.causationList,
        causation: causationId,
      },
    });
  }
}
