import { DomainEvent } from "../../message";
import { ViewStoreQuery, ViewData, ViewIdentifier, IViewStore } from "../../types";
import { View } from "../../entity";
import { filter, includes, isBoolean, isObject, isString, map } from "lodash";
import { ViewCausationError, ViewRevisionError } from "../../error";
import { Logger } from "@lindorm-io/winston";

export class ViewStoreInMemory<State> implements IViewStore<State> {
  private readonly logger: Logger;
  readonly views: Record<string, ViewData<State>>;

  constructor(logger: Logger) {
    this.logger = logger.createChildLogger(["ViewStoreInMemory"]);
    this.views = {};
  }

  public async save(view: View<State>, causation: DomainEvent): Promise<View<State>> {
    const identifier = View.identifier(view);

    const clone: ViewData<State> = {
      id: view.id,
      name: view.name,
      context: view.context,
      causationList: view.causationList,
      destroyed: view.destroyed,
      metaState: view.metaState,
      revision: view.revision + 1,
      state: view.state,
    };

    this.tryExistingRevision(view);

    if (includes(clone.causationList, causation.id)) {
      throw new ViewCausationError(view, causation.id);
    }

    clone.causationList.push(causation.id);

    this.views[identifier] = clone;

    return new View(this.views[identifier], this.logger);
  }

  public async load(viewIdentifier: ViewIdentifier): Promise<View<State>> {
    const identifier = View.identifier(viewIdentifier);

    const data = this.views[identifier];
    if (!data) return;

    return new View(data, this.logger);
  }

  public async query(query: ViewStoreQuery): Promise<Array<View<State>>> {
    return map(
      filter(this.views, {
        name: query.name,
        ...(isString(query.id) ? { id: query.id } : {}),
        ...(isString(query.context) ? { context: query.context } : {}),
        ...(isBoolean(query.destroyed) ? { destroyed: query.destroyed } : {}),
        ...(isObject(query.state) ? { state: query.state as any } : {}),
      }),
      (item) => new View(item, this.logger),
    );
  }

  private getExistingRevision(view: View<State>): number {
    const identifier = View.identifier(view);

    return this.views[identifier] ? this.views[identifier].revision : 0;
  }

  private tryExistingRevision(view: View<State>): void {
    const existingRevision = this.getExistingRevision(view);

    if (view.revision !== existingRevision) {
      throw new ViewRevisionError(view, existingRevision);
    }
  }
}
