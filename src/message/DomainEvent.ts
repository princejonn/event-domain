import { Message } from "./Message";
import { IMessage, MessageOptions } from "../types";
import { Command } from "./Command";
import { MessageType } from "../enum";

export class DomainEvent extends Message implements IMessage {
  constructor(options: MessageOptions, causation?: Command) {
    super(
      {
        ...options,
        type: MessageType.EVENT,
      },
      causation,
    );
  }
}
