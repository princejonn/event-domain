export interface HandlerIdentifier {
  name: string;
  context: string;
}

export interface HandlerConditions {
  created?: boolean;
  permanent?: boolean;
}

export interface HandlerIdentifierExpectingStructure {
  name?: string;
  context?: string;
}

export interface HandlerIdentifierMultipleContexts {
  name: string;
  context?: Array<string> | string;
}
