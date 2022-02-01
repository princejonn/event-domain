import { DomainEvent } from "../message";
import { IllegalEntityChangeError, ViewDestroyedError } from "../error";
import { Logger } from "@lindorm-io/winston";
import { MetaState } from "../enum";
import { assertCamelCase, validateSchemaSync } from "../util";
import { cloneDeep, find, get, isEqual, isMatch, remove, set, some } from "lodash";
import { isAfter, parseJSON } from "date-fns";
import {
  SagaIdentifier,
  IView,
  ViewOptions,
  AnyType,
  GenericRecord,
  ViewData,
} from "../types";
import {
  VIEW_ADD_FIELD_SCHEMA,
  VIEW_REMOVE_FIELD_WHERE_EQUAL_SCHEMA,
  VIEW_REMOVE_FIELD_WHERE_MATCH_SCHEMA,
  VIEW_SET_STATE_SCHEMA,
} from "../schema";

export class View<State> implements IView<State> {
  readonly id: string;
  readonly name: string;
  readonly context: string;

  private readonly _causationList: Array<string>;
  private readonly _metaState: Record<string, any>;
  private readonly _revision: number;
  private readonly _state: GenericRecord<State>;
  private _destroyed: boolean;

  private readonly logger: Logger;

  constructor(options: ViewOptions<State>, logger: Logger) {
    this.logger = logger.createChildLogger(["View"]);

    assertCamelCase(options.name);

    this.id = options.id;
    this.name = options.name;
    this.context = options.context;

    this._causationList = options.causationList || [];
    this._destroyed = options.destroyed || false;
    this._metaState = options.metaState || {};
    this._revision = options.revision || 0;
    this._state = options.state || {};
  }

  public get causationList(): Array<string> {
    return this._causationList;
  }
  public set causationList(_) {
    throw new IllegalEntityChangeError();
  }

  public get destroyed(): boolean {
    return this._destroyed;
  }
  public set destroyed(_) {
    throw new IllegalEntityChangeError();
  }

  public get metaState(): Record<string, any> {
    return this._metaState;
  }
  public set metaState(_) {
    throw new IllegalEntityChangeError();
  }

  public get revision(): number {
    return this._revision;
  }
  public set revision(_) {
    throw new IllegalEntityChangeError();
  }

  public get state(): GenericRecord<State> {
    return this._state;
  }
  public set state(v: GenericRecord<State>) {
    throw new IllegalEntityChangeError();
  }

  public addField(causation: DomainEvent, path: string, value: AnyType): void {
    this.logger.debug("adding field", { causation, path, value });

    validateSchemaSync(VIEW_ADD_FIELD_SCHEMA, { path, value, causation });

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    const timestamp = causation.timestamp;
    const meta = get(this._metaState, path, []) as Array<any>;
    const field = get(this._state, path, []) as Array<any>;
    const exists = find(field, (item) => isEqual(item, value));

    const hasMoreRecentChange = some(
      meta,
      (item) =>
        isEqual(item[MetaState.VALUE], value) &&
        isAfter(parseJSON(item[MetaState.TIMESTAMP]), timestamp),
    );

    if (hasMoreRecentChange) {
      return;
    }

    remove(meta, (item) => isEqual(item[MetaState.VALUE], value));

    meta.push({
      [MetaState.REMOVED]: false,
      [MetaState.TIMESTAMP]: timestamp,
      [MetaState.VALUE]: value,
    });

    if (!exists) {
      field.push(value);
    }

    set(this._state, path, field);
    set(this._metaState, path, meta);
  }

  public destroy(): void {
    this.logger.debug("destroying");

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    this._destroyed = true;
  }

  public removeFieldWhereEqual(
    causation: DomainEvent,
    path: string,
    value: AnyType,
  ): void {
    this.logger.debug("removing field where equal", { causation, path, value });

    validateSchemaSync(VIEW_REMOVE_FIELD_WHERE_EQUAL_SCHEMA, { path, value, causation });

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    const timestamp = causation.timestamp;
    const meta = get(this._metaState, path, []) as Array<any>;
    const field = get(this._state, path, []) as Array<any>;
    const exists = find(field, (item) => isEqual(item, value));

    if (!exists) {
      throw new Error("No existing value can be found");
    }

    const hasMoreRecentChange = some(
      meta,
      (item) =>
        isEqual(item[MetaState.VALUE], value) &&
        isAfter(parseJSON(item[MetaState.TIMESTAMP]), timestamp),
    );

    if (hasMoreRecentChange) {
      return;
    }

    remove(meta, (item) => isEqual(item[MetaState.VALUE], value));
    remove(field, (item) => isEqual(item, value));

    meta.push({
      [MetaState.REMOVED]: true,
      [MetaState.TIMESTAMP]: timestamp,
      [MetaState.VALUE]: exists,
    });

    set(this._state, path, field);
    set(this._metaState, path, meta);
  }

  public removeFieldWhereMatch(
    causation: DomainEvent,
    path: string,
    value: Record<string, any>,
  ): void {
    this.logger.debug("removing field where matching", { causation, path, value });

    validateSchemaSync(VIEW_REMOVE_FIELD_WHERE_MATCH_SCHEMA, { path, value, causation });

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    const timestamp = causation.timestamp;
    const meta = get(this._metaState, path, []) as Array<any>;
    const field = get(this._state, path, []) as Array<any>;
    const exists = find<Record<string, any>>(field, value);

    if (!exists) {
      throw new Error("No matching value can be found");
    }

    const hasMoreRecentChange = some(
      meta,
      (item) =>
        isMatch(item[MetaState.VALUE], value) &&
        isAfter(parseJSON(item[MetaState.TIMESTAMP]), timestamp),
    );

    if (hasMoreRecentChange) {
      return;
    }

    remove(meta, (item) => isMatch(item[MetaState.VALUE], value));
    remove(field, (item) => isMatch(item, value));

    meta.push({
      [MetaState.REMOVED]: true,
      [MetaState.TIMESTAMP]: timestamp,
      [MetaState.VALUE]: exists,
    });

    set(this._state, path, field);
    set(this._metaState, path, meta);
  }

  public setState(causation: DomainEvent, path: string, value: AnyType): void {
    this.logger.debug("setting state", { causation, path, value });

    validateSchemaSync(VIEW_SET_STATE_SCHEMA, { path, value, causation });

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    const timestamp = causation.timestamp;
    const meta = get(this.metaState, path, { timestamp }) as Record<string, any>;
    const hasMoreRecentChange = isAfter(parseJSON(meta[MetaState.TIMESTAMP]), timestamp);

    if (hasMoreRecentChange) {
      return;
    }

    set(this._state, path, value);
    set(this._metaState, path, {
      [MetaState.REMOVED]: false,
      [MetaState.TIMESTAMP]: timestamp,
      [MetaState.VALUE]: value,
    });
  }

  public toJSON(): ViewData<State> {
    return {
      id: this.id,
      name: this.name,
      context: this.context,
      causationList: cloneDeep(this.causationList),
      destroyed: this.destroyed,
      metaState: cloneDeep(this.metaState),
      revision: this.revision,
      state: cloneDeep(this.state),
    };
  }

  static identifier(identifier: SagaIdentifier): string {
    return `${identifier.context}.${identifier.name}.${identifier.id}`;
  }
}
