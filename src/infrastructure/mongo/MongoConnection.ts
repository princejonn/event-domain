import { Collection, Db, MongoClient, MongoClientOptions } from "mongodb";
import { IndexOptions, IMongoConnection, MongoConnectionOptions } from "../../types";
import { Logger } from "@lindorm-io/winston";
import { merge } from "lodash";

export class MongoConnection implements IMongoConnection {
  private readonly clientOptions: MongoClientOptions;
  private readonly collectionName: string;
  private readonly databaseName: string;
  private readonly indices: Array<IndexOptions<any>>;
  private readonly url: string;
  private client: MongoClient;
  private collection: Collection;
  private database: Db;
  private logger: Logger;

  constructor(options: MongoConnectionOptions) {
    const { collectionName, databaseName, host, indices, winston, port, ...clientOptions } = options;

    this.logger = winston.createChildLogger(["MongoConnection", options.databaseName, options.collectionName]);

    this.collectionName = collectionName;
    this.databaseName = databaseName;
    this.indices = indices;
    this.clientOptions = clientOptions || {};
    this.url = `mongodb://${host}:${port}`;
  }

  public async connect(): Promise<Collection> {
    this.logger.debug("creating connection", {
      clientOptions: this.clientOptions,
      collectionName: this.collectionName,
      databaseName: this.databaseName,
      url: this.url,
    });

    try {
      this.client = await MongoClient.connect(
        this.url,
        merge(
          {
            useNewUrlParser: true,
            useUnifiedTopology: true,
          },
          this.clientOptions,
        ),
      );

      this.database = await this.client.db(this.databaseName);
      this.collection = await this.database.collection(this.collectionName);

      for (const { index, options } of this.indices) {
        await this.collection.createIndex(index, options);
      }

      this.logger.debug("connection created");

      return this.collection;
    } catch (err) {
      this.logger.error("connection failed", err);

      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    await this.client.close();

    this.logger.debug("connection closed");
  }
}
