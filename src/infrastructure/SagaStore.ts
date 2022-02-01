import {
  SagaIdentifier,
  ISagaStore,
  SagaStoreOptions,
  SagaStoreSaveOptions,
} from "../types";
import { Logger } from "@lindorm-io/winston";
import { Message } from "../message";
import { Saga } from "../entity";
import { SagaStoreInMemory } from "./in-memory";
import { SagaStoreMongo } from "./mongo";
import { StoreType } from "../enum";
import { CLEAR_SAGA_MESSAGES_TO_DISPATCH_SCHEMA, SAVE_SAGA_SCHEMA } from "../schema";
import { validateSchemaAsync } from "../util";

export class SagaStore<State> {
  private readonly logger: Logger;
  private sagaStore: ISagaStore<State>;

  constructor(logger: Logger, options?: SagaStoreOptions) {
    this.logger = logger.createChildLogger(["SagaStore"]);

    const type = options?.type || StoreType.MEMORY;

    switch (type) {
      case StoreType.CUSTOM:
        this.sagaStore = options.custom;
        break;

      case StoreType.MEMORY:
        this.sagaStore = new SagaStoreInMemory(this.logger);
        break;

      case StoreType.MONGO:
        this.sagaStore = new SagaStoreMongo(this.logger, options.mongo);
        break;

      default:
        throw new Error("Invalid Store Type");
    }
  }

  public async save(
    saga: Saga<State>,
    causation: Message,
    options?: SagaStoreSaveOptions,
  ): Promise<Saga<State>> {
    await validateSchemaAsync(SAVE_SAGA_SCHEMA, {
      saga,
      causation,
      messagesToDispatch: saga.messagesToDispatch,
    });

    try {
      const result = await this.sagaStore.save(saga, causation, options);

      this.logger.debug("successfully saved saga", { saga: Saga.identifier(saga) });
      return result;
    } catch (err) {
      this.logger.error("failed to save saga", { saga: Saga.identifier(saga) });
      throw err;
    }
  }

  public async load(sagaIdentifier: SagaIdentifier): Promise<Saga<State>> {
    try {
      const result = await this.sagaStore.load(sagaIdentifier);

      if (!result) {
        this.logger.debug("successfully created saga", {
          saga: Saga.identifier(sagaIdentifier),
        });
        return new Saga({ ...sagaIdentifier, messagesToDispatch: [] }, this.logger);
      }

      this.logger.debug("successfully loaded saga", { saga: Saga.identifier(result) });
      return result;
    } catch (err) {
      this.logger.error("failed to load saga", { saga: Saga.identifier(sagaIdentifier) });
      throw err;
    }
  }

  public async clearMessagesToDispatch(saga: Saga<State>): Promise<Saga<State>> {
    await validateSchemaAsync(CLEAR_SAGA_MESSAGES_TO_DISPATCH_SCHEMA, {
      saga,
      messagesToDispatch: saga.messagesToDispatch,
    });

    try {
      const result = await this.sagaStore.clearMessagesToDispatch(saga);

      this.logger.debug("successfully cleared messages to dispatch", {
        saga: Saga.identifier(saga),
      });

      return result;
    } catch (err) {
      this.logger.error("failed to clear messages to dispatch", {
        saga: Saga.identifier(saga),
      });

      throw err;
    }
  }
}
