import { AnyType, GenericRecord } from "./generic";
import { Command, DomainEvent } from "../message";

export interface ISaga<State> extends SagaData<State> {
  destroy(): void;
  dispatch(causation: DomainEvent, command: Command): void;
  mergeState(data: Record<string, any>): void;
  setState(path: string, value: AnyType): void;
  toJSON(): SagaData<State>;
}

export interface SagaData<State> {
  id: string;
  name: string;
  context: string;

  causationList: Array<string>;
  messagesToDispatch: Array<Command>;
  destroyed: boolean;
  revision: number;
  state: GenericRecord<State>;
}

export interface SagaOptions<State> {
  id: string;
  name: string;
  context: string;

  causationList?: Array<string>;
  destroyed?: boolean;
  messagesToDispatch?: Array<Command>;
  revision?: number;
  state?: GenericRecord<State>;
}

export interface SagaIdentifier {
  id: string;
  name: string;
  context: string;
}
