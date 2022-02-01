import MockDate from "mockdate";
import { Aggregate } from "../entity";
import { AggregateEventHandler } from "../handler";
import { CausationMissingEventsError, EventStreamRevisionError } from "../error";
import { Command, DomainEvent } from "../message";
import { EventStore } from "./EventStore";
import {
  aggregateIdentifier,
  commandWithData,
  eventHandlerWithData,
  logger,
} from "../test";

MockDate.set("2022-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "e64b576a-022e-4dd4-8c97-32408012f8d1"),
}));

describe("EventStore", () => {
  describe("when creating a new event store with default options", () => {
    it("should succeed", () => {
      expect(new EventStore(logger)).toStrictEqual(expect.any(EventStore));
    });
  });

  describe("when creating a new event store with erroneous options", () => {
    test("should throw", () => {
      expect(
        () =>
          new EventStore(logger, {
            // @ts-ignore
            type: "wrong",
          }),
      ).toThrow();
    });
  });

  describe("when saving events to store", () => {
    let eventStore: EventStore<any>;
    let aggregate: Aggregate<any>;

    beforeAll(async () => {
      eventStore = new EventStore(logger);

      aggregate = new Aggregate(
        {
          ...aggregateIdentifier,
          eventHandlers: [eventHandlerWithData],
        },
        logger,
      );

      await aggregate.apply(commandWithData, "eventWithData", commandWithData.data);
    });

    it("should resolve the appended events", async () => {
      await expect(
        eventStore.save(aggregate, commandWithData),
      ).resolves.toMatchSnapshot();
    });

    it("should save the causation events to the store", () => {
      // @ts-ignore
      expect(eventStore.eventStore.eventsByAggregate).toMatchSnapshot();
    });
  });

  describe("when loading events from store", () => {
    let eventStore: EventStore<any>;
    let handler1: AggregateEventHandler<any>;

    beforeAll(async () => {
      eventStore = new EventStore(logger);

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

      handler1 = new AggregateEventHandler({
        eventName: "event1",
        aggregate: aggregateIdentifier,
        handler: async (ctx) => {
          ctx.mergeState(ctx.event.data);
        },
      });

      const aggregate = new Aggregate(
        {
          ...aggregateIdentifier,
          eventHandlers: [handler1],
        },
        logger,
      );

      // @ts-ignore
      await aggregate.handleEvent(event1);

      await eventStore.save(aggregate, command1);
    });

    it("should load all events for aggregate", async () => {
      await expect(
        eventStore.load(aggregateIdentifier, [handler1]),
      ).resolves.toMatchSnapshot();
    });
  });

  describe("when there are no events on causation", () => {
    let eventStore: EventStore<any>;
    let aggregate: Aggregate<any>;
    let command2: Command;

    beforeAll(async () => {
      eventStore = new EventStore(logger);

      const command1 = new Command({
        id: "86e9a7ee-7455-4438-9c61-7e41bd0191d5",
        name: "command1",
        aggregate: aggregateIdentifier,
      });

      command2 = new Command({
        id: "ce9e080c-ced9-4e26-9eb5-c6620b9c72e7",
        name: "command2",
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

      const handler1 = new AggregateEventHandler({
        eventName: "event1",
        aggregate: aggregateIdentifier,
        handler: async (ctx) => {
          ctx.mergeState(ctx.event.data);
        },
      });

      aggregate = new Aggregate(
        {
          ...aggregateIdentifier,
          eventHandlers: [handler1],
        },
        logger,
      );

      await aggregate.load(event1);
    });

    it("should throw", async () => {
      await expect(eventStore.save(aggregate, command2)).rejects.toThrow(
        CausationMissingEventsError,
      );
    });
  });

  describe("when event tails are different", () => {
    let eventStore: EventStore<any>;
    let aggregate: Aggregate<any>;
    let command2: Command;

    beforeAll(async () => {
      eventStore = new EventStore(logger);

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

      const handler1 = new AggregateEventHandler({
        eventName: "event1",
        aggregate: aggregateIdentifier,
        handler: async (ctx) => {
          ctx.mergeState(ctx.event.data);
        },
      });

      command2 = new Command({
        id: "bfc357a9-d0ac-4429-8cc3-ef75ed9caa73",
        name: "command2",
        aggregate: aggregateIdentifier,
      });

      const event2 = new DomainEvent(
        {
          id: "6901ee53-e05d-412a-8221-890b1a4a4673",
          name: "event2",
          aggregate: aggregateIdentifier,
          data: { eventData: true },
        },
        command2,
      );

      const handler2 = new AggregateEventHandler({
        eventName: "event2",
        aggregate: aggregateIdentifier,
        handler: async (ctx) => {
          ctx.mergeState(ctx.event.data);
        },
      });

      aggregate = new Aggregate(
        {
          ...aggregateIdentifier,
          eventHandlers: [handler1, handler2],
        },
        logger,
      );

      // @ts-ignore
      await aggregate.handleEvent(event1);

      await eventStore.save(aggregate, command1);

      // @ts-ignore
      await aggregate.handleEvent(event2);
    });

    it("should throw when the tails are different", async () => {
      await expect(eventStore.save(aggregate, command2)).rejects.toThrow(
        EventStreamRevisionError,
      );
    });
  });
});
