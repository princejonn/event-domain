import { IndexOptions, MongoOptions } from "./mongo";
import { ViewIdentifier } from "./view";
import { Message } from "../message";
import { StoreType } from "../enum";
import { View } from "../entity";

export interface IViewStore<State> {
  save(
    view: View<State>,
    causation: Message,
    options?: ViewStoreCollectionOptions<State>,
  ): Promise<View<State>>;
  load(
    viewIdentifier: ViewIdentifier,
    options?: ViewStoreCollectionOptions<State>,
  ): Promise<View<State>>;
  query(query: ViewStoreQuery): Promise<Array<View<State>>>;
}

export interface ViewStoreOptions {
  custom?: IViewStore<any>;
  mongo?: MongoOptions;
  type?: StoreType;
}

export interface ViewStoreQuery {
  id?: string;
  name: string;
  context?: string;
  destroyed?: boolean;
  state?: Record<string, any>;
}

export interface ViewStoreCollectionOptions<State> {
  collectionName?: string;
  indices?: Array<IndexOptions<State>>;
}
