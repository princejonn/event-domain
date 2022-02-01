import { Collection, Filter, UpdateFilter } from "mongodb";
import { Logger } from "@lindorm-io/winston";
import { Message } from "../../message";
import { MongoConnection } from "./MongoConnection";
import { MongoDuplicateKeyError, MongoNotUpdatedError } from "../../error";
import { View } from "../../entity";
import { ViewStoreField } from "../../enum";
import { map, merge } from "lodash";
import {
  MongoOptions,
  IViewStore,
  MongoConnectionOptions,
  ViewData,
  ViewIdentifier,
  ViewStoreCollectionOptions,
  ViewStoreQuery,
} from "../../types";

export class ViewStoreMongo<State> implements IViewStore<State> {
  private readonly logger: Logger;
  private readonly options: MongoConnectionOptions;

  constructor(logger: Logger, options: MongoOptions) {
    this.logger = logger.createChildLogger(["ViewStoreMongo"]);

    this.options = merge(
      {
        collectionName: "views",
        databaseName: "event_domain",
        indices: [
          {
            index: {
              [`${[ViewStoreField.PATH]}.id`]: 1,
              [`${[ViewStoreField.PATH]}.name`]: 1,
              [`${[ViewStoreField.PATH]}.context`]: 1,
            },
            options: {
              name: "unique_path",
              unique: true,
            },
          },
          {
            index: {
              [`${[ViewStoreField.PATH]}.id`]: 1,
              [`${[ViewStoreField.PATH]}.name`]: 1,
              [`${[ViewStoreField.PATH]}.context`]: 1,
              [ViewStoreField.CAUSATION_LIST]: 1,
            },
            options: {
              name: "unique_causation",
              unique: true,
            },
          },
          {
            index: {
              [`${[ViewStoreField.PATH]}.id`]: 1,
              [`${[ViewStoreField.PATH]}.name`]: 1,
              [`${[ViewStoreField.PATH]}.context`]: 1,
              [ViewStoreField.REVISION]: 1,
            },
            options: {
              name: "unique_revision",
              unique: true,
            },
          },
        ],
        winston: this.logger,
      },
      options,
    );
  }

  public async save(
    view: View<State>,
    causation: Message,
    options?: ViewStoreCollectionOptions<State>,
  ): Promise<View<State>> {
    this.logger.debug("save initialised", { view, causation, options });

    const connection = new MongoConnection(this.getMongoOptions(view.name, options));

    try {
      const collection = await connection.connect();

      const existing = await collection.findOne(
        {
          [ViewStoreField.PATH]: { id: view.id, name: view.name, context: view.context },
          [ViewStoreField.CAUSATION_LIST]: { $in: [causation.id] },
        },
        {
          projection: {
            [ViewStoreField.CAUSATION_LIST]: 1,
            [ViewStoreField.DESTROYED]: 1,
            [ViewStoreField.META_STATE]: 1,
            [ViewStoreField.REVISION]: 1,
            [ViewStoreField.STATE]: 1,
          },
        },
      );

      this.logger.debug("existing", { existing });

      if (existing) {
        this.logger.debug("existing found");

        return new View(
          {
            id: view.id,
            name: view.name,
            context: view.context,
            causationList: existing[ViewStoreField.CAUSATION_LIST],
            destroyed: existing[ViewStoreField.DESTROYED],
            metaState: existing[ViewStoreField.META_STATE],
            revision: existing[ViewStoreField.REVISION],
            state: existing[ViewStoreField.STATE],
          },
          this.logger,
        );
      }

      if (view.revision === 0) {
        this.logger.debug("inserting", { view });

        return await this.insert(collection, view, causation);
      }

      this.logger.debug("updating", { view });

      return await this.update(collection, view, causation);
    } finally {
      await connection.disconnect();
    }
  }

  public async load(
    viewIdentifier: ViewIdentifier,
    options?: ViewStoreCollectionOptions<State>,
  ): Promise<View<State>> {
    this.logger.debug("load initialised", { viewIdentifier, options });

    const connection = new MongoConnection(
      this.getMongoOptions(viewIdentifier.name, options),
    );

    try {
      const collection = await connection.connect();

      const existing = await collection.findOne(
        {
          [ViewStoreField.PATH]: {
            id: viewIdentifier.id,
            name: viewIdentifier.name,
            context: viewIdentifier.context,
          },
        },
        {
          projection: {
            [ViewStoreField.CAUSATION_LIST]: 1,
            [ViewStoreField.DESTROYED]: 1,
            [ViewStoreField.META_STATE]: 1,
            [ViewStoreField.REVISION]: 1,
            [ViewStoreField.STATE]: 1,
          },
        },
      );

      if (existing) {
        const json: ViewData<State> = {
          id: viewIdentifier.id,
          name: viewIdentifier.name,
          context: viewIdentifier.context,
          causationList: existing[ViewStoreField.CAUSATION_LIST],
          destroyed: existing[ViewStoreField.DESTROYED],
          metaState: existing[ViewStoreField.META_STATE],
          revision: existing[ViewStoreField.REVISION],
          state: existing[ViewStoreField.STATE],
        };

        this.logger.debug("existing found", { view: json });

        return new View(json, this.logger);
      }

      this.logger.debug("existing not found");
    } catch (err) {
      this.logger.debug("load failed", err);

      throw err;
    } finally {
      await connection.disconnect();
    }
  }

  public async query(
    query: ViewStoreQuery,
    options?: ViewStoreCollectionOptions<State>,
  ): Promise<Array<View<State>>> {
    this.logger.debug("query initialised", { query });

    if (!query.name) {
      throw new Error("[name] must be specified on identifier");
    }

    const filter: Record<string, any> = {
      [`${[ViewStoreField.PATH]}.name`]: query.name,
      ...(query.id ? { [`${[ViewStoreField.PATH]}.id`]: query.id } : {}),
      ...(query.context ? { [`${[ViewStoreField.PATH]}.context`]: query.context } : {}),
      ...(query.destroyed ? { [ViewStoreField.DESTROYED]: query.destroyed } : {}),
    };

    if (query.state) {
      for (const [key, value] of Object.entries(query.state)) {
        filter[`${ViewStoreField.STATE}.${key}`] = value;
      }
    }

    this.logger.debug("query filter", { filter });

    const connection = new MongoConnection(this.getMongoOptions(query.name, options));

    try {
      const collection = await connection.connect();

      const cursor = await collection.find(filter);
      const result = await cursor.toArray();

      this.logger.debug("query successful", { result });

      return map(
        result,
        (json) =>
          new View(
            {
              id: json[ViewStoreField.PATH].id,
              name: json[ViewStoreField.PATH].name,
              context: json[ViewStoreField.PATH].context,
              causationList: json[ViewStoreField.CAUSATION_LIST],
              destroyed: json[ViewStoreField.DESTROYED],
              metaState: json[ViewStoreField.META_STATE],
              revision: json[ViewStoreField.REVISION],
              state: json[ViewStoreField.STATE],
            },
            this.logger,
          ),
      );
    } catch (err) {
      this.logger.debug("query failed", err);

      throw err;
    } finally {
      await connection.disconnect();
    }
  }

  private getMongoOptions(
    name: string,
    options?: ViewStoreCollectionOptions<State>,
  ): MongoConnectionOptions {
    return merge(this.options, {
      collectionName: `view_${options?.collectionName || name}`,
      indices: options?.indices || [],
    });
  }

  private async insert(
    collection: Collection,
    view: View<State>,
    causation: Message,
  ): Promise<View<State>> {
    const json = {
      [ViewStoreField.CAUSATION_LIST]: [causation.id],
      [ViewStoreField.DESTROYED]: view.destroyed,
      [ViewStoreField.META_STATE]: view.metaState,
      [ViewStoreField.REVISION]: view.revision + 1,
      [ViewStoreField.STATE]: view.state,
      [ViewStoreField.TIMESTAMP]: new Date(),
      [ViewStoreField.TIME_MODIFIED]: new Date(),
      [ViewStoreField.PATH]: { id: view.id, name: view.name, context: view.context },
    };

    try {
      const result = await collection.insertOne(json);

      this.logger.debug("insert successful", { json, result });

      return new View(
        {
          id: view.id,
          name: view.name,
          context: view.context,
          causationList: [causation.id],
          destroyed: view.destroyed,
          metaState: view.metaState,
          revision: view.revision + 1,
          state: view.state,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("insert failed", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }

  private async update(
    collection: Collection,
    view: View<State>,
    causation: Message,
  ): Promise<View<State>> {
    this.logger.debug("update initialised", { view, causation });

    const filter: Filter<any> = {
      [ViewStoreField.PATH]: { id: view.id, name: view.name, context: view.context },
      [ViewStoreField.REVISION]: view.revision,
    };
    const update: UpdateFilter<any> = {
      $set: {
        [ViewStoreField.DESTROYED]: view.destroyed,
        [ViewStoreField.META_STATE]: view.metaState,
        [ViewStoreField.REVISION]: view.revision + 1,
        [ViewStoreField.STATE]: view.state,
        [ViewStoreField.TIME_MODIFIED]: new Date(),
      },
      $push: {
        [ViewStoreField.CAUSATION_LIST]: causation.id as never,
      },
    };

    try {
      const result = await collection.findOneAndUpdate(filter, update);
      const success =
        result.ok &&
        result.value &&
        result.lastErrorObject?.n === 1 &&
        result.lastErrorObject?.updatedExisting;

      if (!success) {
        throw new MongoNotUpdatedError(filter, update);
      }

      this.logger.debug("update successful", { result });

      return new View(
        {
          id: view.id,
          name: view.name,
          context: view.context,
          causationList: [...view.causationList, causation.id],
          destroyed: view.destroyed,
          metaState: view.metaState,
          revision: view.revision + 1,
          state: view.state,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("update failed", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }
}
