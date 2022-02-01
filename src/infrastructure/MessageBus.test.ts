import MockDate from "mockdate";
import { Command, DomainEvent } from "../message";
import { MessageBus } from "./MessageBus";
import { logger } from "../test";

MockDate.set("2022-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "e64b576a-022e-4dd4-8c97-32408012f8d1"),
}));

describe("MessageBus", () => {
  const aggregateIdentifier = {
    id: "2a553a74-0f84-4a7d-b91e-2902666db98c",
    name: "name",
    context: "context",
  };

  let messageBus: any;

  beforeEach(() => {
    messageBus = new MessageBus(logger);
  });

  describe("constructor", () => {
    test("should create a message bus", () => {
      expect(new MessageBus(logger)).toStrictEqual(expect.any(MessageBus));
    });

    test("should throw if message bus type is erroneous", () => {
      expect(
        () =>
          new MessageBus({
            // @ts-ignore
            type: "wrong",
          }),
      ).toThrow();
    });
  });

  describe("subscribe", () => {
    let callback: any;
    let handler: any;

    beforeEach(() => {
      callback = jest.fn();
      handler = jest.fn();
    });

    test("should add subscriber", async () => {
      await expect(
        messageBus.subscribe({
          callback,
          sub: {
            name: "event1",
            aggregate: {
              name: aggregateIdentifier.name,
              context: aggregateIdentifier.context,
            },
            handler,
          },
          topic: {
            name: "event1",
            aggregate: {
              name: aggregateIdentifier.name,
              context: aggregateIdentifier.context,
            },
            handler,
          },
        }),
      ).resolves.toBe(undefined);
      expect(messageBus.messageBus.subscriptions).toMatchSnapshot();
    });
  });

  describe("publish", () => {
    let callback: any;

    beforeEach(() => {
      callback = jest.fn().mockResolvedValue(undefined);
    });

    test("should evoke the subscription callback", async () => {
      const command1 = new Command({
        id: "86e9a7ee-7455-4438-9c61-7e41bd0191d5",
        name: "command1",
        aggregate: aggregateIdentifier,
      });
      const event1 = new DomainEvent(
        {
          id: "6d35d053-fc89-4ee5-93d6-87c0ceecb8b3",
          name: "event1",
          aggregate: aggregateIdentifier,
          data: { eventData: true },
        },
        command1,
      );
      await messageBus.subscribe({
        callback,
        sub: {
          name: "event1",
          aggregate: {
            name: aggregateIdentifier.name,
            context: aggregateIdentifier.context,
          },
        },
        topic: {
          name: "event1",
          aggregate: {
            name: aggregateIdentifier.name,
            context: aggregateIdentifier.context,
          },
        },
      });

      await expect(messageBus.publish([event1])).resolves.toBe(undefined);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
