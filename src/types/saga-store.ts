import { MongoOptions } from "./mongo";
import { SagaIdentifier } from "./saga";
import { Message } from "../message";
import { Saga } from "../entity";
import { StoreType } from "../enum";

export interface ISagaStore<State> {
  save(saga: Saga<State>, causation: Message, options?: SagaStoreSaveOptions): Promise<Saga<State>>;
  load(sagaIdentifier: SagaIdentifier): Promise<Saga<State>>;
  clearMessagesToDispatch(saga: Saga<State>): Promise<Saga<State>>;
}

export interface SagaStoreOptions {
  custom?: ISagaStore<any>;
  mongo?: MongoOptions;
  type?: StoreType;
}

export interface SagaStoreSaveOptions {
  causationsCap?: number;
}
