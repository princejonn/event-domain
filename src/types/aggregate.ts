import { AggregateEventHandler } from "../handler";
import { Command, DomainEvent } from "../message";
import { GenericRecord } from "./generic";

export interface IAggregate<State> extends AggregateData<State> {
  apply(causation: Command, name: string, data?: Record<string, any>): Promise<void>;
  load(event: DomainEvent): void;
  toJSON(): AggregateData<State>;
}

export interface AggregateData<State> {
  id: string;
  name: string;
  context: string;

  destroyed: boolean;
  events: Array<DomainEvent>;
  numberOfLoadedEvents: number;
  state: GenericRecord<State>;
}

export interface AggregateOptions<State> {
  id: string;
  name: string;
  context: string;

  eventHandlers: Array<AggregateEventHandler<State>>;
}

export interface AggregateIdentifier {
  id: string;
  name: string;
  context: string;
}
