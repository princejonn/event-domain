import { DomainEvent } from "../message";
import { AggregateIdentifier } from "./aggregate";
import { MongoOptions } from "./mongo";
import { StoreType } from "../enum";

export interface IEventStore {
  save(causationEvents: Array<DomainEvent>, expectedEvents: Array<DomainEvent>): Promise<Array<DomainEvent>>;
  load(aggregateIdentifier: AggregateIdentifier): Promise<Array<DomainEvent>>;
}

export interface EventStoreOptions {
  custom?: IEventStore;
  type?: StoreType;
  mongo?: MongoOptions;
}
