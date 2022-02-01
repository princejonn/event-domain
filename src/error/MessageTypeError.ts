import { LindormError } from "@lindorm-io/errors";

export class MessageTypeError extends LindormError {
  constructor(message: any, expect: any) {
    super("Message is not a valid type", {
      debug: {
        expect: typeof expect,
        actual: typeof message,
      },
    });
  }
}
