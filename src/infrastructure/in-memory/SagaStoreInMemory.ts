import { Logger } from "@lindorm-io/winston";
import { Message } from "../../message";
import { Saga } from "../../entity";
import { SagaCausationError, SagaNotInStoreError, SagaRevisionError } from "../../error";
import { SagaData, SagaIdentifier, ISagaStore, SagaStoreSaveOptions } from "../../types";
import { includes } from "lodash";

export class SagaStoreInMemory<State> implements ISagaStore<State> {
  private readonly logger: Logger;
  readonly sagas: Record<string, SagaData<State>>;
  readonly saveAttempts: Array<any>;
  readonly clearAttempts: Array<any>;

  constructor(logger: Logger) {
    this.logger = logger.createChildLogger(["SagaStoreInMemory"]);
    this.sagas = {};
    this.saveAttempts = [];
    this.clearAttempts = [];
  }

  public async save(
    saga: Saga<State>,
    causation: Message,
    options?: SagaStoreSaveOptions,
  ): Promise<Saga<State>> {
    this.saveAttempts.push({ saga, causation, options });

    const identifier = Saga.identifier(saga);

    const clone: SagaData<State> = {
      id: saga.id,
      name: saga.name,
      context: saga.context,
      causationList: saga.causationList,
      messagesToDispatch: saga.messagesToDispatch,
      destroyed: saga.destroyed,
      revision: saga.revision + 1,
      state: saga.state,
    };

    this.tryExistingRevision(saga);

    if (includes(clone.causationList, causation.id)) {
      throw new SagaCausationError(saga, causation.id);
    }

    clone.causationList.push(causation.id);

    if (options?.causationsCap > 0) {
      clone.causationList = clone.causationList.slice(options.causationsCap * -1);
    }

    this.sagas[identifier] = clone;

    return new Saga(this.sagas[identifier], this.logger);
  }

  public async load(sagaIdentifier: SagaIdentifier): Promise<Saga<State>> {
    const identifier = Saga.identifier(sagaIdentifier);

    const data = this.sagas[identifier];
    if (!data) return;

    return new Saga(data, this.logger);
  }

  public async clearMessagesToDispatch(saga: Saga<State>): Promise<Saga<State>> {
    this.clearAttempts.push(saga);

    const identifier = Saga.identifier(saga);

    if (!this.sagas[identifier]) {
      throw new SagaNotInStoreError();
    }

    const clone: SagaData<State> = {
      id: saga.id,
      name: saga.name,
      context: saga.context,
      causationList: saga.causationList,
      messagesToDispatch: [],
      destroyed: saga.destroyed,
      revision: saga.revision + 1,
      state: saga.state,
    };

    this.tryExistingRevision(saga);

    this.sagas[identifier] = clone;

    return new Saga(this.sagas[identifier], this.logger);
  }

  private getExistingRevision(saga: Saga<State>): number {
    const identifier = Saga.identifier(saga);

    return this.sagas[identifier] ? this.sagas[identifier].revision : 0;
  }

  private tryExistingRevision(saga: Saga<State>): void {
    const existingRevision = this.getExistingRevision(saga);

    if (saga.revision !== existingRevision) {
      throw new SagaRevisionError(saga, existingRevision);
    }
  }
}
