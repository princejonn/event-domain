import { DomainEvent } from "../message";
import { Logger } from "@lindorm-io/winston";
import { StoreType } from "../enum";
import { View } from "../entity";
import { ViewStoreInMemory } from "./in-memory";
import { ViewStoreMongo } from "./mongo";
import {
  IViewStore,
  ViewIdentifier,
  ViewStoreCollectionOptions,
  ViewStoreOptions,
  ViewStoreQuery,
} from "../types";

export class ViewStore<State> implements IViewStore<State> {
  private readonly logger: Logger;
  private store: IViewStore<State>;

  constructor(logger: Logger, options?: ViewStoreOptions) {
    this.logger = logger.createChildLogger(["ViewStore"]);

    const type = options?.type || StoreType.MEMORY;

    switch (type) {
      case StoreType.CUSTOM:
        this.store = options.custom;
        break;

      case StoreType.MEMORY:
        this.store = new ViewStoreInMemory(this.logger);
        break;

      case StoreType.MONGO:
        this.store = new ViewStoreMongo(this.logger, options.mongo);
        break;

      default:
        throw new Error("Invalid Store Type");
    }
  }

  public async save(
    view: View<State>,
    causation: DomainEvent,
    options?: ViewStoreCollectionOptions<State>,
  ): Promise<View<State>> {
    try {
      const result = await this.store.save(view, causation, options);

      this.logger.debug("successfully saved view", { view: View.identifier(view) });

      return result;
    } catch (err) {
      this.logger.error("failed to save view", { view: View.identifier(view) });

      throw err;
    }
  }

  public async load(
    viewIdentifier: ViewIdentifier,
    options?: ViewStoreCollectionOptions<State>,
  ): Promise<View<State>> {
    try {
      const result = await this.store.load(viewIdentifier, options);

      if (!result) {
        this.logger.debug("successfully created view", {
          view: View.identifier(viewIdentifier),
        });

        return new View(viewIdentifier, this.logger);
      }

      this.logger.debug("successfully loaded view", {
        view: View.identifier(viewIdentifier),
      });

      return result;
    } catch (err) {
      this.logger.error("failed to load view", { view: View.identifier(viewIdentifier) });

      throw err;
    }
  }

  public async query(query: ViewStoreQuery): Promise<Array<View<State>>> {
    try {
      const result = await this.store.query(query);

      this.logger.debug("successfully queried view", { query, length: result.length });

      return result;
    } catch (err) {
      this.logger.error("failed to query view", { query });

      throw err;
    }
  }
}
