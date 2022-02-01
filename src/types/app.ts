import { EventStoreOptions } from "./event-store";
import { MessageBusOptions } from "./message-bus";
import { SagaStoreOptions } from "./saga-store";
import { ViewStoreOptions } from "./view-store";
import { Logger } from "@lindorm-io/winston";

export interface AppOptions {
  domain?: AppDomain;

  aggregates?: AppStructure;
  sagas?: AppStructure;
  views?: AppStructure;

  messageBus?: MessageBusOptions;
  eventStore?: EventStoreOptions;
  sagaStore?: SagaStoreOptions;
  viewStore?: ViewStoreOptions;

  logger: Logger;

  require?: NodeJS.Require;
}

export interface AppDomain {
  directory?: string;
  context?: string;
}

export interface AppStructure {
  directory: string;
  include?: Array<RegExp>;
  exclude?: Array<RegExp>;
  extensions?: Array<string>;
}
