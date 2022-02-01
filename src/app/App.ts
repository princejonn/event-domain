/* eslint @typescript-eslint/no-var-requires: 0 */

import { AggregateDomain, SagaDomain, ViewDomain } from "../domain";
import { Command } from "../message";
import { Logger } from "@lindorm-io/winston";
import { MessageBus } from "../infrastructure";
import { MessageBusType, StoreType } from "../enum";
import { StructureScanner } from "../util";
import { View } from "../entity";
import { join } from "path";
import { merge } from "lodash";
import {
  AppOptions,
  AppStructure,
  EventEmitterCallback,
  EventType,
  ViewStoreQuery,
} from "../types";
import {
  AggregateCommandHandler,
  AggregateEventHandler,
  SagaEventHandler,
  ViewEventHandler,
} from "../handler";

export class App {
  private readonly logger: Logger;
  private readonly messageBus: MessageBus;
  private options: AppOptions;
  private promise: () => Promise<void>;
  private aggregateDomain: AggregateDomain<unknown>;
  private sagaDomain: SagaDomain<unknown>;
  private viewDomain: ViewDomain<unknown>;

  constructor(options: AppOptions) {
    this.logger = options.logger.createChildLogger(["EventDomain"]);

    this.options = merge(
      {
        domain: {
          directory: null,
          context: "default",
        },

        aggregates: {
          directory: options.domain?.directory
            ? join(options.domain?.directory, "aggregates")
            : options.aggregates?.directory,
          include: [/.*/],
          exclude: [],
          extensions: [".js", ".ts"],
        },
        sagas: {
          directory: options.domain?.directory
            ? join(options.domain?.directory, "sagas")
            : options.aggregates?.directory,
          include: [/.*/],
          exclude: [],
          extensions: [".js", ".ts"],
        },
        views: {
          directory: options.domain?.directory
            ? join(options.domain?.directory, "views")
            : options.aggregates?.directory,
          include: [/.*/],
          exclude: [],
          extensions: [".js", ".ts"],
        },

        messageBus: {
          type: MessageBusType.MEMORY,
        },
        eventStore: {
          type: StoreType.MEMORY,
        },
        sagaStore: {
          type: StoreType.MEMORY,
        },
        viewStore: {
          type: StoreType.MEMORY,
        },

        require: require,
      },
      options,
    );

    this.messageBus = new MessageBus(this.logger, this.options.messageBus);

    this.aggregateDomain = new AggregateDomain({
      eventStore: this.options.eventStore,
      messageBus: { type: MessageBusType.CUSTOM, custom: this.messageBus },
      logger: this.logger,
    });
    this.sagaDomain = new SagaDomain({
      sagaStore: this.options.sagaStore,
      messageBus: { type: MessageBusType.CUSTOM, custom: this.messageBus },
      logger: this.logger,
    });
    this.viewDomain = new ViewDomain({
      viewStore: this.options.viewStore,
      messageBus: { type: MessageBusType.CUSTOM, custom: this.messageBus },
      logger: this.logger,
    });

    this.promise = this.initialise;
  }

  // public

  public async publish(command: Command): Promise<void> {
    await this.promise();

    if (!(command instanceof Command)) {
      throw Error("[command] not instanceof Command");
    }

    await this.messageBus.publish([command]);
  }

  public on<State>(evt: EventType, callback: EventEmitterCallback<State>): void {
    if (["aggregate:success", "aggregate:error"].includes(evt)) {
      this.aggregateDomain.on<State>(evt, callback);
    }

    if (["saga:success", "saga:error"].includes(evt)) {
      this.sagaDomain.on<State>(evt, callback);
    }

    if (["view:success", "view:error"].includes(evt)) {
      this.viewDomain.on<State>(evt, callback);
    }
  }

  public async query<ViewState>(query: ViewStoreQuery): Promise<Array<View<ViewState>>> {
    await this.promise();

    return await this.viewDomain.query(query);
  }

  // private

  private async initialise(): Promise<void> {
    if (StructureScanner.hasFiles(this.options.aggregates.directory)) {
      await this.scanAggregates();
    }

    if (StructureScanner.hasFiles(this.options.sagas.directory)) {
      await this.scanSagas();
    }

    if (StructureScanner.hasFiles(this.options.views.directory)) {
      await this.scanViews();
    }

    this.promise = (): Promise<void> => Promise.resolve();
  }

  private async scanAggregates(): Promise<void> {
    const scanner = new StructureScanner(
      this.options.aggregates.directory,
      this.options.aggregates.extensions,
    );
    const files = scanner.scan();

    for (const file of files) {
      if (file.parents.length !== 2) {
        throw new Error(
          "expected folder structure: [ ./aggregates/{aggregateName}/{commands|events}/{handler} ]",
        );
      }

      const type = file.parents[0];
      const aggregateName = file.parents[1];

      if (!this.isValid("aggregate", aggregateName, this.options.aggregates)) break;

      const handler = this.options.require(file.path).default;

      switch (type) {
        case "commands":
          if (!(handler instanceof AggregateCommandHandler)) {
            throw new Error("handler not instanceof AggregateCommandHandler");
          }
          await this.aggregateDomain.registerCommandHandler(
            new AggregateCommandHandler({
              aggregate: {
                name: handler.aggregate.name || aggregateName,
                context: handler.aggregate.context || this.options.domain.context,
              },
              commandName: handler.commandName || file.name,
              conditions: handler.conditions,
              schema: handler.schema,
              handler: handler.handler,
            }),
          );
          break;

        case "events":
          if (!(handler instanceof AggregateEventHandler)) {
            throw new Error("handler not instanceof AggregateEventHandler");
          }
          await this.aggregateDomain.registerEventHandler(
            new AggregateEventHandler({
              aggregate: {
                name: handler.aggregate.name || aggregateName,
                context: handler.aggregate.context || this.options.domain.context,
              },
              eventName: handler.eventName || file.name,
              handler: handler.handler,
            }),
          );
          break;

        default:
          throw new Error(
            "expected folder structure: [ ./aggregates/{aggregateName}/{commands|events}/{handler} ]",
          );
      }
    }
  }

  private async scanSagas(): Promise<void> {
    const scanner = new StructureScanner(
      this.options.sagas.directory,
      this.options.sagas.extensions,
    );
    const files = scanner.scan();

    for (const file of files) {
      if (file.parents.length !== 1) {
        throw new Error("expected folder structure: [ ./sagas/{sagaName}/{handler} ]");
      }

      const sagaName = file.parents[0];

      if (!this.isValid("saga", sagaName, this.options.sagas)) break;

      const handler = this.options.require(file.path).default;

      if (!(handler instanceof SagaEventHandler)) {
        throw new Error("handler not instanceof SagaEventHandler");
      }

      await this.sagaDomain.registerEventHandler(
        new SagaEventHandler({
          aggregate: {
            name: handler.aggregate.name,
            context: handler.aggregate.context || this.options.domain.context,
          },
          conditions: handler.conditions,
          eventName: handler.eventName,
          getSagaId: handler.getSagaId,
          saga: {
            name: handler.saga.name || sagaName,
            context: handler.saga.context || this.options.domain.context,
          },
          saveOptions: handler.saveOptions,
          handler: handler.handler,
        }),
      );
    }
  }

  private async scanViews(): Promise<void> {
    const scanner = new StructureScanner(
      this.options.views.directory,
      this.options.views.extensions,
    );
    const files = scanner.scan();

    for (const file of files) {
      if (file.parents.length !== 1) {
        throw new Error("expected folder structure: [ ./views/{viewName}/{handler} ]");
      }

      const viewName = file.parents[0];

      if (!this.isValid("view", viewName, this.options.views)) break;

      const handler = this.options.require(file.path).default;

      if (!(handler instanceof ViewEventHandler)) {
        throw new Error("handler not instanceof ViewEventHandler");
      }

      await this.viewDomain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: handler.aggregate.name,
            context: handler.aggregate.context || this.options.domain.context,
          },
          conditions: handler.conditions,
          eventName: handler.eventName,
          getViewId: handler.getViewId,
          loadOptions: handler.loadOptions,
          saveOptions: handler.saveOptions,
          view: {
            name: handler.view.name || viewName,
            context: handler.view.context || this.options.domain.context,
          },
          handler: handler.handler,
        }),
      );
    }
  }

  private isValid(type: string, name: string, structure: AppStructure): boolean {
    for (const regExp of structure.include) {
      if (!regExp.test(name)) {
        this.logger.warn(`${type} [ ${name} ] is not included in domain`);
        return false;
      }
    }

    for (const regExp of structure.exclude) {
      if (regExp.test(name)) {
        this.logger.warn(`${type} [ ${name} ] is excluded in domain`);
        return false;
      }
    }

    return true;
  }
}
