import { Command, DomainEvent } from "../message";
import { Aggregate, Saga, View } from "../entity";

export type EventType =
  | "aggregate:success"
  | "aggregate:error"
  | "saga:success"
  | "saga:error"
  | "view:success"
  | "view:error";

export type EventEmitterErrorCallback = (error: Error) => void;

export type EventEmitterAggregateCallback<State> = (
  command: Command,
  aggregate: Aggregate<State>,
) => void;

export type EventEmitterSagaCallback<State> = (domainEvent: DomainEvent, saga: Saga<State>) => void;

export type EventEmitterViewCallback<State> = (domainEvent: DomainEvent, view: View<State>) => void;

export type EventEmitterCallback<State> =
  | EventEmitterErrorCallback
  | EventEmitterAggregateCallback<State>
  | EventEmitterSagaCallback<State>
  | EventEmitterViewCallback<State>;
