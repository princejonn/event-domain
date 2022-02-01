import { Command, DomainEvent, Timeout } from "../message";
import {
  ISaga,
  SagaIdentifier,
  SagaOptions,
  AnyType,
  GenericRecord,
  SagaData,
} from "../types";
import { IllegalEntityChangeError, MessageTypeError, SagaDestroyedError } from "../error";
import { SAGA_DISPATCH_SCHEMA, SAGA_UPDATE_STATE_SCHEMA } from "../schema";
import { assertCamelCase, validateSchemaSync } from "../util";
import { cloneDeep, merge, set } from "lodash";
import { Logger } from "@lindorm-io/winston";

export class Saga<State> implements ISaga<State> {
  readonly id: string;
  readonly name: string;
  readonly context: string;

  private readonly _causationList: Array<string>;
  private readonly _messagesToDispatch: Array<Command | DomainEvent>;
  private readonly _revision: number;
  private readonly _state: GenericRecord<State>;
  private _destroyed: boolean;

  private readonly logger: Logger;

  constructor(options: SagaOptions<State>, logger: Logger) {
    this.logger = logger.createChildLogger(["Saga"]);

    assertCamelCase(options.name);

    this.id = options.id;
    this.name = options.name;
    this.context = options.context;

    this._causationList = options.causationList || [];
    this._destroyed = options.destroyed || false;
    this._messagesToDispatch = options.messagesToDispatch || [];
    this._revision = options.revision || 0;
    this._state = options.state || {};
  }

  public get causationList(): Array<string> {
    return this._causationList;
  }
  public set causationList(_) {
    throw new IllegalEntityChangeError();
  }

  public get messagesToDispatch(): Array<Command> {
    return this._messagesToDispatch;
  }
  public set messagesToDispatch(_) {
    throw new IllegalEntityChangeError();
  }

  public get destroyed(): boolean {
    return this._destroyed;
  }
  public set destroyed(_) {
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
  public set state(_) {
    throw new IllegalEntityChangeError();
  }

  public destroy(): void {
    this.logger.debug("destroying");

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    this._destroyed = true;
  }

  public dispatch(causation: DomainEvent, command: Command): void {
    this.logger.debug("dispatching command", { causation, command });

    validateSchemaSync(SAGA_DISPATCH_SCHEMA, { command, causation });

    if (!(command instanceof Command)) {
      throw new MessageTypeError(command, Command);
    }

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    this._messagesToDispatch.push(
      new Command(
        merge(
          {
            aggregate: {
              context: this.context,
            },
          },
          command,
        ),
        causation,
      ),
    );
  }

  public mergeState(data: Record<string, any>): void {
    this.logger.debug("merging state", { data });

    validateSchemaSync(SAGA_UPDATE_STATE_SCHEMA, { data });

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    merge(this._state, data);
  }

  public setState(path: string, value: AnyType): void {
    this.logger.debug("setting state", { path, value });

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    set(this._state, path, value);
  }

  public timeout(
    causation: DomainEvent,
    name: string,
    data: Record<string, any>,
    delay: number,
  ): void {
    this.logger.debug("dispatching timeout", { causation, name, data, delay });

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    this._messagesToDispatch.push(
      new Timeout(
        {
          name,
          data,
          aggregate: {
            id: this.id,
            name: this.name,
            context: this.context,
          },
          delay,
        },
        causation,
      ),
    );
  }

  public toJSON(): SagaData<State> {
    return {
      id: this.id,
      name: this.name,
      context: this.context,
      causationList: cloneDeep(this.causationList),
      messagesToDispatch: cloneDeep(this.messagesToDispatch),
      destroyed: this.destroyed,
      revision: this.revision,
      state: cloneDeep(this.state),
    };
  }

  static identifier(identifier: SagaIdentifier): string {
    return `${identifier.context}.${identifier.name}.${identifier.id}`;
  }
}
