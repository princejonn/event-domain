import {
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  IViewEventHandler,
  ViewEventHandlerContext,
  ViewEventHandlerOptions,
  ViewStoreCollectionOptions,
  GetViewIdFunction,
} from "../types";

export class ViewEventHandler<State> implements IViewEventHandler<State> {
  readonly aggregate: HandlerIdentifierMultipleContexts;
  readonly conditions: HandlerConditions;
  readonly eventName: string;
  readonly getViewId: GetViewIdFunction;
  readonly loadOptions: ViewStoreCollectionOptions<State>;
  readonly saveOptions: ViewStoreCollectionOptions<State>;
  readonly view: HandlerIdentifier;
  readonly handler: (context: ViewEventHandlerContext<State>) => Promise<void>;

  constructor(options: ViewEventHandlerOptions<State>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.conditions = options.conditions || {};
    this.eventName = options.eventName;
    this.getViewId = options.getViewId;
    this.loadOptions = options.loadOptions || {};
    this.saveOptions = options.saveOptions || {};
    this.view = { name: options.view?.name, context: options.view?.context };
    this.handler = options.handler;
  }
}
