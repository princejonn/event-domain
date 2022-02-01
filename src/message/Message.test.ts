import MockDate from "mockdate";
import { IMessage, MessageOptions } from "../types";
import { Message } from "./Message";
import { MessageType } from "../enum";

MockDate.set("2022-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "e64b576a-022e-4dd4-8c97-32408012f8d1"),
}));

class TestMessage extends Message {
  constructor(options: MessageOptions, causation?: IMessage) {
    super(options, causation);
  }
}

describe("Message", () => {
  test("should create a message", () => {
    expect(
      new TestMessage({
        name: "name",
        aggregate: {
          id: "id",
          name: "name",
          context: "context",
        },
      }),
    ).toMatchSnapshot();
  });

  test("should set id as correlation by default", () => {
    expect(
      new TestMessage({
        id: "bacbc463-f3dc-4978-a719-8bcdddb54931",
        name: "name",
        aggregate: {
          id: "id",
          name: "name",
          context: "context",
        },
      }),
    ).toMatchSnapshot();
  });

  test("should respect options", () => {
    expect(
      new TestMessage({
        id: "8a7d01b6-dc4c-42a2-a444-4f4003747994",
        name: "name",
        type: MessageType.EVENT,
        aggregate: { id: "id", name: "name", context: "context" },
        causationId: "83863312-21d6-46a6-b34d-1fb660de5bea",
        correlationId: "97d2378f-43d1-4446-88b4-bcd4cb7aa44b",
        data: { value: 1 },
        delay: 999,
        mandatory: true,
        timestamp: new Date("1999-01-01"),
      }),
    ).toMatchSnapshot();
  });

  test("should prioritize options over causation", () => {
    expect(
      new TestMessage(
        {
          name: "name",
          aggregate: { id: "id", name: "name", context: "context" },
          causationId: "83863312-21d6-46a6-b34d-1fb660de5bea",
          correlationId: "97d2378f-43d1-4446-88b4-bcd4cb7aa44b",
        },
        new TestMessage({
          id: "9bdbf988-c405-4e07-bf43-e30a10c8ed9a",
          name: "name",
          aggregate: { id: "id", name: "name", context: "context" },
          correlationId: "dd514fa0-08eb-404e-993e-a9687977bd23",
        }),
      ),
    ).toMatchSnapshot();
  });

  test("should fall back to causation", () => {
    expect(
      new TestMessage(
        {
          name: "name",
          aggregate: { id: "id", name: "name", context: "context" },
        },
        new TestMessage({
          id: "9bdbf988-c405-4e07-bf43-e30a10c8ed9a",
          name: "name",
          aggregate: { id: "id", name: "name", context: "context" },
          correlationId: "dd514fa0-08eb-404e-993e-a9687977bd23",
        }),
      ),
    ).toMatchSnapshot();
  });

  test("should convert timestamp to Date when string", () => {
    expect(
      new TestMessage({
        name: "name",
        aggregate: { id: "id", name: "name", context: "context" },
        timestamp: "2000-10-10T09:00:00.888Z",
      }),
    ).toMatchSnapshot();
  });
});
