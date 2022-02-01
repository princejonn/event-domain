import { Collection, Filter, UpdateFilter } from "mongodb";
import { Logger } from "@lindorm-io/winston";
import { Message } from "../../message";
import { MongoConnection } from "./MongoConnection";
import { MongoDuplicateKeyError, MongoNotUpdatedError } from "../../error";
import { Saga } from "../../entity";
import { SagaStoreField } from "../../enum";
import { merge } from "lodash";
import {
  MongoOptions,
  SagaData,
  SagaIdentifier,
  ISagaStore,
  SagaStoreSaveOptions,
  MongoConnectionOptions,
} from "../../types";

export class SagaStoreMongo<State> implements ISagaStore<State> {
  private readonly logger: Logger;
  private readonly mongo: MongoConnectionOptions;

  constructor(logger: Logger, options: MongoOptions) {
    this.logger = logger.createChildLogger(["SagaStoreMongo"]);

    this.mongo = merge(
      {
        collectionName: "sagas",
        databaseName: "event_domain",
        indices: [
          {
            index: {
              [`${[SagaStoreField.PATH]}.id`]: 1,
              [`${[SagaStoreField.PATH]}.name`]: 1,
              [`${[SagaStoreField.PATH]}.context`]: 1,
            },
            options: {
              name: "unique_path",
              unique: true,
            },
          },
          {
            index: {
              [`${[SagaStoreField.PATH]}.id`]: 1,
              [`${[SagaStoreField.PATH]}.name`]: 1,
              [`${[SagaStoreField.PATH]}.context`]: 1,
              [SagaStoreField.CAUSATION_LIST]: 1,
            },
            options: {
              name: "unique_causation",
              unique: true,
            },
          },
          {
            index: {
              [`${[SagaStoreField.PATH]}.id`]: 1,
              [`${[SagaStoreField.PATH]}.name`]: 1,
              [`${[SagaStoreField.PATH]}.context`]: 1,
              [SagaStoreField.REVISION]: 1,
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
    saga: Saga<State>,
    causation: Message,
    options?: SagaStoreSaveOptions,
  ): Promise<Saga<State>> {
    this.logger.debug("save initialised", { saga, causation, options });

    const connection = new MongoConnection(this.mongo);

    try {
      const collection = await connection.connect();

      const existing = await collection.findOne(
        {
          [SagaStoreField.PATH]: { id: saga.id, name: saga.name, context: saga.context },
          [SagaStoreField.CAUSATION_LIST]: { $in: [causation.id] },
        },
        {
          projection: {
            [SagaStoreField.CAUSATION_LIST]: 1,
            [SagaStoreField.COMMANDS_TO_DISPATCH]: 1,
            [SagaStoreField.DESTROYED]: 1,
            [SagaStoreField.REVISION]: 1,
            [SagaStoreField.STATE]: 1,
          },
        },
      );

      this.logger.debug("existing", { existing });

      if (existing) {
        this.logger.debug("existing found");

        return new Saga(
          {
            id: saga.id,
            name: saga.name,
            context: saga.context,
            causationList: existing[SagaStoreField.CAUSATION_LIST],
            messagesToDispatch: existing[SagaStoreField.COMMANDS_TO_DISPATCH],
            destroyed: existing[SagaStoreField.DESTROYED],
            revision: existing[SagaStoreField.REVISION],
            state: existing[SagaStoreField.STATE],
          },
          this.logger,
        );
      }

      if (saga.revision === 0) {
        this.logger.debug("inserting", { saga });

        return await this.insert(collection, saga, causation);
      }

      this.logger.debug("updating", { saga });

      return await this.update(collection, saga, causation, options);
    } finally {
      await connection.disconnect();
    }
  }

  public async load(sagaIdentifier: SagaIdentifier): Promise<Saga<State>> {
    this.logger.debug("load initialised", { sagaIdentifier });

    const connection = new MongoConnection(this.mongo);

    try {
      const collection = await connection.connect();

      const existing = await collection.findOne(
        {
          [SagaStoreField.PATH]: {
            id: sagaIdentifier.id,
            name: sagaIdentifier.name,
            context: sagaIdentifier.context,
          },
        },
        {
          projection: {
            [SagaStoreField.CAUSATION_LIST]: 1,
            [SagaStoreField.COMMANDS_TO_DISPATCH]: 1,
            [SagaStoreField.DESTROYED]: 1,
            [SagaStoreField.REVISION]: 1,
            [SagaStoreField.STATE]: 1,
          },
        },
      );

      if (existing) {
        const json: SagaData<State> = {
          id: sagaIdentifier.id,
          name: sagaIdentifier.name,
          context: sagaIdentifier.context,
          causationList: existing[SagaStoreField.CAUSATION_LIST],
          messagesToDispatch: existing[SagaStoreField.COMMANDS_TO_DISPATCH],
          destroyed: existing[SagaStoreField.DESTROYED],
          revision: existing[SagaStoreField.REVISION],
          state: existing[SagaStoreField.STATE],
        };

        this.logger.debug("existing found", { saga: json });

        return new Saga(json, this.logger);
      }

      this.logger.debug("existing not found");
    } catch (err) {
      this.logger.debug("load failed", err);

      throw err;
    } finally {
      await connection.disconnect();
    }
  }

  public async clearMessagesToDispatch(saga: Saga<State>): Promise<Saga<State>> {
    this.logger.debug("clearing commands initialised", { saga });

    const filter = {
      [SagaStoreField.PATH]: { id: saga.id, name: saga.name, context: saga.context },
      [SagaStoreField.REVISION]: saga.revision,
    };
    const update = {
      $set: {
        [SagaStoreField.REVISION]: saga.revision + 1,
        [SagaStoreField.COMMANDS_TO_DISPATCH]: [] as Array<undefined>,
        [SagaStoreField.TIME_MODIFIED]: new Date(),
      },
    };

    const connection = new MongoConnection(this.mongo);

    try {
      const collection = await connection.connect();

      const result = await collection.findOneAndUpdate(filter, update);
      const success =
        result.ok &&
        result.value &&
        result.lastErrorObject?.n === 1 &&
        result.lastErrorObject?.updatedExisting;

      if (!success) {
        throw new MongoNotUpdatedError(filter, update);
      }

      this.logger.debug("clearing commands successful", { result });

      return new Saga(
        {
          id: saga.id,
          name: saga.name,
          context: saga.context,
          causationList: saga.causationList,
          messagesToDispatch: [],
          destroyed: saga.destroyed,
          revision: saga.revision + 1,
          state: saga.state,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("clearing commands failed", err);

      throw err;
    } finally {
      await connection.disconnect();
    }
  }

  private async insert(
    collection: Collection,
    saga: Saga<State>,
    causation: Message,
  ): Promise<Saga<State>> {
    this.logger.debug("insert initialised", { saga, causation });

    const json = {
      [SagaStoreField.CAUSATION_LIST]: [causation.id],
      [SagaStoreField.COMMANDS_TO_DISPATCH]: saga.messagesToDispatch,
      [SagaStoreField.DESTROYED]: saga.destroyed,
      [SagaStoreField.REVISION]: saga.revision + 1,
      [SagaStoreField.PATH]: { id: saga.id, name: saga.name, context: saga.context },
      [SagaStoreField.STATE]: saga.state,
      [SagaStoreField.TIMESTAMP]: new Date(),
      [SagaStoreField.TIME_MODIFIED]: new Date(),
    };

    try {
      const result = await collection.insertOne(json);

      this.logger.debug("insert successful", { json, result });

      return new Saga(
        {
          id: saga.id,
          name: saga.name,
          context: saga.context,
          causationList: [causation.id],
          messagesToDispatch: saga.messagesToDispatch,
          destroyed: saga.destroyed,
          revision: saga.revision + 1,
          state: saga.state,
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
    saga: Saga<State>,
    causation: Message,
    options?: SagaStoreSaveOptions,
  ): Promise<Saga<State>> {
    this.logger.debug("update initialised", { saga, causation });

    const filter: Filter<any> = {
      [SagaStoreField.PATH]: { id: saga.id, name: saga.name, context: saga.context },
      [SagaStoreField.REVISION]: saga.revision,
    };

    const update: UpdateFilter<any> = {
      $set: {
        [SagaStoreField.COMMANDS_TO_DISPATCH]: saga.messagesToDispatch,
        [SagaStoreField.DESTROYED]: saga.destroyed,
        [SagaStoreField.REVISION]: saga.revision + 1,
        [SagaStoreField.STATE]: saga.state,
        [SagaStoreField.TIME_MODIFIED]: new Date(),
      },
      $push: {
        [SagaStoreField.CAUSATION_LIST]: (options?.causationsCap &&
        options?.causationsCap > 0
          ? { $each: [causation.id], $slice: options.causationsCap * -1 }
          : causation.id) as never,
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

      return new Saga(
        {
          id: saga.id,
          name: saga.name,
          context: saga.context,
          causationList:
            options?.causationsCap && options?.causationsCap > 0
              ? [...saga.causationList, causation.id].slice(options.causationsCap * -1)
              : [...saga.causationList, causation.id],
          messagesToDispatch: saga.messagesToDispatch,
          destroyed: saga.destroyed,
          revision: saga.revision + 1,
          state: saga.state,
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
