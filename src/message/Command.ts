import { MessageOptions, IMessage } from "../types";
import { Message } from "./Message";
import { MessageType } from "../enum";

export class Command extends Message implements IMessage {
  constructor(options: MessageOptions, causation?: Message) {
    super(
      {
        ...options,
        mandatory: true,
        type: MessageType.COMMAND,
      },
      causation,
    );
  }
}
