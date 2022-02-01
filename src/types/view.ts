import { AnyType, GenericRecord } from "./generic";
import { DomainEvent } from "../message";

export interface IView<State> extends ViewData<State> {
  addField(causation: DomainEvent, path: string, value: AnyType): void;
  destroy(): void;
  removeFieldWhereEqual(causation: DomainEvent, path: string, value: AnyType): void;
  removeFieldWhereMatch(causation: DomainEvent, path: string, value: Record<string, any>): void;
  setState(causation: DomainEvent, path: string, value: AnyType): void;
  toJSON(): ViewData<State>;
}

export interface ViewData<State> {
  id: string;
  name: string;
  context: string;

  causationList: Array<string>;
  destroyed: boolean;
  metaState: Record<string, any>;
  revision: number;
  state: GenericRecord<State>;
}

export interface ViewOptions<State> {
  id: string;
  name: string;
  context: string;

  causationList?: Array<string>;
  destroyed?: boolean;
  metaState?: Record<string, any>;
  revision?: number;
  state?: GenericRecord<State>;
}

export interface ViewIdentifier {
  id: string;
  name: string;
  context: string;
}
