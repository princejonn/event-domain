import { Collection, CreateIndexesOptions, IndexDirection, MongoClientOptions } from "mongodb";
import { Logger } from "@lindorm-io/winston";

export interface IMongoConnection {
  connect(): Promise<Collection>;
  disconnect(): Promise<void>;
}

export interface IndexOptions<Interface> {
  index: {
    [key in keyof Interface]?: IndexDirection;
  };
  options: CreateIndexesOptions;
}

export interface MongoOptions extends MongoClientOptions {
  host: string;
  port: number;
}

export interface MongoConnectionOptions<Interface = any> extends MongoOptions {
  collectionName: string;
  databaseName: string;
  indices: Array<IndexOptions<Interface>>;
  winston: Logger;
}
