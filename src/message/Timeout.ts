import { IMessage, MessageOptions } from "../types";
import { Message } from "./Message";
import { MessageType } from "../enum";

export class Timeout extends Message implements IMessage {
  constructor(options: MessageOptions, causation?: Message) {
    super(
      {
        ...options,
        mandatory: true,
        type: MessageType.TIMEOUT,
      },
      causation,
    );
  }
}
