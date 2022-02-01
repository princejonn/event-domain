import { AGGREGATE_MERGE_STATE_SCHEMA, getApplyEventSchema } from "../schema";
import { AggregateEventHandler } from "../handler";
import { Command, DomainEvent } from "../message";
import { Logger } from "@lindorm-io/winston";
import { assertCamelCase, validateSchemaAsync, validateSchemaSync } from "../util";
import { cloneDeep, find, merge, set } from "lodash";
import {
  AggregateData,
  AggregateEventHandlerContext,
  AggregateIdentifier,
  AggregateOptions,
  AnyType,
  GenericRecord,
  IAggregate,
} from "../types";
import {
  AggregateDestroyedError,
  AggregateNotDestroyedError,
  HandlerNotRegisteredError,
  IllegalEntityChangeError,
  MessageTypeError,
} from "../error";

export class Aggregate<State> implements IAggregate<State> {
  readonly id: string;
  readonly name: string;
  readonly context: string;

  private readonly _eventHandlers: Array<AggregateEventHandler<State>>;
  private readonly _events: Array<DomainEvent>;
  private readonly _state: GenericRecord<State>;
  private _destroyed: boolean;
  private _destroying: boolean;
  private _numberOfLoadedEvents: number;

  private readonly logger: Logger;

  constructor(options: AggregateOptions<State>, logger: Logger) {
    this.logger = logger.createChildLogger(["Aggregate"]);

    assertCamelCase(options.name);

    this.id = options.id;
    this.name = options.name;
    this.context = options.context;

    this._destroyed = false;
    this._destroying = false;
    this._eventHandlers = options.eventHandlers || [];
    this._events = [];
    this._numberOfLoadedEvents = 0;
    this._state = {};
  }

  public get destroyed(): boolean {
    return this._destroyed;
  }
  public set destroyed(_) {
    throw new IllegalEntityChangeError();
  }

  public get events(): Array<DomainEvent> {
    return this._events;
  }
  public set events(_) {
    throw new IllegalEntityChangeError();
  }

  public get numberOfLoadedEvents(): number {
    return this._numberOfLoadedEvents;
  }
  public set numberOfLoadedEvents(_) {
    throw new IllegalEntityChangeError();
  }

  public get state(): GenericRecord<State> {
    return this._state;
  }
  public set state(_) {
    throw new IllegalEntityChangeError();
  }

  public async apply(
    causation: Command,
    name: string,
    data?: Record<string, any>,
  ): Promise<void> {
    this.logger.debug("applying command", { causation, name, data });

    await this.handleEvent(
      new DomainEvent(
        {
          aggregate: { id: this.id, name: this.name, context: this.context },
          data: data,
          name: name,
        },
        causation,
      ),
    );
  }

  public async load(event: DomainEvent): Promise<void> {
    this.logger.debug("loading event", { event });

    await this.handleEvent(event);
    this._numberOfLoadedEvents += 1;
  }

  private async handleEvent(event: DomainEvent): Promise<void> {
    this.logger.debug("handling event", { event });

    if (!(event instanceof DomainEvent)) {
      throw new MessageTypeError(event, DomainEvent);
    }

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    const destroying = this._destroying;

    await validateSchemaAsync(
      getApplyEventSchema({
        id: this.id,
        name: this.name,
        context: this.context,
      }),
      {
        name: event.name,
        aggregate: event.aggregate,
        data: event.data,
        causationId: event.causationId,
      },
    );

    const eventHandler: AggregateEventHandler<State> = find(
      this._eventHandlers,
      (handler) => handler.eventName === event.name,
    );

    if (!(eventHandler instanceof AggregateEventHandler)) {
      throw new HandlerNotRegisteredError();
    }

    const context: AggregateEventHandlerContext<State> = {
      event: event,
      state: cloneDeep(this._state),
      logger: this.logger.createChildLogger(["AggregateEventHandler"]),
      destroy: this.destroy.bind(this),
      destroyNext: this.destroyNext.bind(this),
      mergeState: this.mergeState.bind(this),
      setState: this.setState.bind(this),
    };

    await eventHandler.handler(context);

    if (destroying && !this._destroyed) {
      throw new AggregateNotDestroyedError();
    }

    this._events.push(event);

    this.logger.debug("successfully handled event", { event });
  }

  private destroy(): void {
    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    this._destroyed = true;
    this._destroying = false;
  }

  private destroyNext(): void {
    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    this._destroying = true;
  }

  private mergeState(data: Record<string, any>): void {
    validateSchemaSync(AGGREGATE_MERGE_STATE_SCHEMA, { data });

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    merge(this._state, data);
  }

  private setState(path: string, value: AnyType): void {
    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    set(this._state, path, value);
  }

  public toJSON(): AggregateData<State> {
    return {
      id: this.id,
      name: this.name,
      context: this.context,
      destroyed: this.destroyed,
      events: cloneDeep(this.events),
      numberOfLoadedEvents: cloneDeep(this.numberOfLoadedEvents),
      state: cloneDeep(this.state),
    };
  }

  static identifier(identifier: AggregateIdentifier): string {
    return `${identifier.context}.${identifier.name}.${identifier.id}`;
  }
}
