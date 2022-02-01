import MockDate from "mockdate";
import { Aggregate } from "./Aggregate";
import { AggregateEventHandler } from "../handler";
import { Command, DomainEvent } from "../message";
import {
  AggregateDestroyedError,
  AggregateNotDestroyedError,
  IllegalEntityChangeError,
} from "../error";
import {
  aggregateIdentifier,
  commandWithData,
  commandWithDestroy,
  commandWithDestroyNext,
  eventHandlerWithData,
  eventHandlerWithDestroy,
  eventHandlerWithDestroyNext,
  logger,
} from "../test";

MockDate.set("2022-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "e64b576a-022e-4dd4-8c97-32408012f8d1"),
}));

describe("Aggregate", () => {
  describe("when creating an aggregate with camelCase name", () => {
    it("should create aggregate", () => {
      expect(
        () =>
          new Aggregate(
            {
              id: "id",
              name: "camelCasedName",
              context: "default",
              eventHandlers: [],
            },
            logger,
          ),
      ).not.toThrow();
    });
  });

  describe("when creating an aggregate with non-camelCase name", () => {
    it("should throw", () => {
      expect(
        () =>
          new Aggregate(
            {
              id: "id",
              name: "snake_case_name",
              context: "default",
              eventHandlers: [],
            },
            logger,
          ),
      ).toThrow(new Error("snake_case_name is not in camelCase"));
    });
  });

  describe("when applying a command with data", () => {
    let aggregate: Aggregate<any>;

    beforeAll(async () => {
      aggregate = new Aggregate(
        {
          ...aggregateIdentifier,
          eventHandlers: [
            new AggregateEventHandler({
              eventName: "eventWithData",
              aggregate: aggregateIdentifier,
              handler: async (ctx) => {
                ctx.mergeState(ctx.event.data);
                ctx.setState("OBJ.STR", "value");
                ctx.setState("OBJ.OBJ.NUM", 123456);
              },
            }),
          ],
        },
        logger,
      );

      // @ts-ignore
      await aggregate.setState("OBJ.STR", "overwrite");
      // @ts-ignore
      await aggregate.setState("name", { bar: "baz" });

      await aggregate.apply(
        new Command({
          id: "6c2e5bbd-6643-469d-92ba-f6a140d42cb4",
          name: "commandWithData",
          data: { name: "hello" },
          aggregate: aggregateIdentifier,
        }),
        "eventWithData",
        { name: { first: "hello", foo: "bar" } },
      );
    });

    it("should add events to array", () => {
      expect(aggregate.events).toMatchSnapshot();
    });

    it("should set state and overwrite old values", () => {
      expect(aggregate.state.OBJ.STR).toBe("value");
    });

    it("should set state with new values", () => {
      expect(aggregate.state.OBJ.OBJ.NUM).toBe(123456);
    });

    it("should merge state with new values", () => {
      expect(aggregate.state.name.first).toBe("hello");
      expect(aggregate.state.name.foo).toBe("bar");
    });

    it("should merge state with old values", () => {
      expect(aggregate.state.name.bar).toBe("baz");
    });
  });

  describe("when applying a command with destroyNext", () => {
    let aggregate: Aggregate<any>;

    beforeAll(async () => {
      aggregate = new Aggregate(
        {
          ...aggregateIdentifier,
          eventHandlers: [
            eventHandlerWithData,
            eventHandlerWithDestroy,
            eventHandlerWithDestroyNext,
          ],
        },
        logger,
      );

      await aggregate.apply(commandWithDestroyNext, "eventWithDestroyNext", {});
    });

    it("should expect aggregate to be destroyed next", () => {
      // @ts-ignore
      expect(aggregate._destroying).toBe(true);
    });

    it("should expect aggregate to not be destroyed yet", () => {
      expect(aggregate.destroyed).toBe(false);
    });
  });

  describe("when applying a command with destroy", () => {
    let aggregate: Aggregate<any>;

    beforeAll(async () => {
      aggregate = new Aggregate(
        {
          ...aggregateIdentifier,
          eventHandlers: [
            eventHandlerWithData,
            eventHandlerWithDestroy,
            eventHandlerWithDestroyNext,
          ],
        },
        logger,
      );

      await aggregate.apply(commandWithDestroy, "eventWithDestroy", {});
    });

    it("should set aggregate as destroyed", () => {
      expect(aggregate.destroyed).toBe(true);
    });
  });

  describe("when applying a command with destroy after destroyNext", () => {
    let aggregate: Aggregate<any>;

    beforeAll(async () => {
      aggregate = new Aggregate(
        {
          ...aggregateIdentifier,
          eventHandlers: [
            eventHandlerWithData,
            eventHandlerWithDestroy,
            eventHandlerWithDestroyNext,
          ],
        },
        logger,
      );

      await aggregate.apply(commandWithDestroyNext, "eventWithDestroyNext", {});
      await aggregate.apply(commandWithDestroy, "eventWithDestroy", {});
    });

    it("should set destroying to false", () => {
      // @ts-ignore
      expect(aggregate._destroying).toBe(false);
    });

    it("should expect aggregate to be destroyed", () => {
      expect(aggregate.destroyed).toBe(true);
    });
  });

  describe("when applying a command with data after destroyNext", () => {
    let aggregate: Aggregate<any>;

    beforeAll(async () => {
      aggregate = new Aggregate(
        {
          ...aggregateIdentifier,
          eventHandlers: [
            eventHandlerWithData,
            eventHandlerWithDestroy,
            eventHandlerWithDestroyNext,
          ],
        },
        logger,
      );

      await aggregate.apply(commandWithDestroyNext, "eventWithDestroyNext", {});
    });

    it("should throw AggregateNotDestroyedError", async () => {
      await expect(
        aggregate.apply(commandWithData, "eventWithData", commandWithData.data),
      ).rejects.toThrow(AggregateNotDestroyedError);
    });
  });

  describe("when applying a command with data after destroy", () => {
    let aggregate: Aggregate<any>;

    beforeAll(async () => {
      aggregate = new Aggregate(
        {
          ...aggregateIdentifier,
          eventHandlers: [
            eventHandlerWithData,
            eventHandlerWithDestroy,
            eventHandlerWithDestroyNext,
          ],
        },
        logger,
      );

      await aggregate.apply(commandWithDestroy, "eventWithDestroy", {});
    });

    it("should throw AggregateDestroyedError", async () => {
      await expect(
        aggregate.apply(commandWithData, "eventWithData", commandWithData.data),
      ).rejects.toThrow(AggregateDestroyedError);
    });
  });

  describe("when loading an existing event", () => {
    let aggregate: Aggregate<any>;

    beforeAll(async () => {
      aggregate = new Aggregate(
        {
          ...aggregateIdentifier,
          eventHandlers: [
            eventHandlerWithData,
            eventHandlerWithDestroy,
            eventHandlerWithDestroyNext,
          ],
        },
        logger,
      );

      await aggregate.load(
        new DomainEvent({
          aggregate: aggregateIdentifier,
          causationId: "ce03d1ac-2f77-4941-88ce-2960aabf6400",
          correlationId: "2038c9e9-349e-4ac4-a750-cd474240c37e",
          data: { freddie: "mercury" },
          delay: 0,
          id: "aed46332-a369-48b7-a100-1a6bbdd13552",
          mandatory: true,
          name: "eventWithData",
          timestamp: new Date("2001-02-03T04:05:06.789Z"),
        }),
      );
    });

    it("should add event list of loaded events", () => {
      expect(aggregate.events).toMatchSnapshot();
    });

    it("should increment number of loaded events", () => {
      expect(aggregate.numberOfLoadedEvents).toBe(1);
    });

    it("should handle event and set state", () => {
      expect(aggregate.state).toMatchSnapshot();
    });
  });

  describe("when trying to set destroyed", () => {
    let aggregate: Aggregate<any>;

    beforeAll(() => {
      aggregate = new Aggregate({ ...aggregateIdentifier, eventHandlers: [] }, logger);
    });

    it("should throw", () => {
      expect(() => {
        aggregate.destroyed = true;
      }).toThrow(IllegalEntityChangeError);
    });
  });

  describe("when trying to set events", () => {
    let aggregate: Aggregate<any>;

    beforeAll(() => {
      aggregate = new Aggregate({ ...aggregateIdentifier, eventHandlers: [] }, logger);
    });

    it("should throw", () => {
      expect(() => {
        aggregate.events = [];
      }).toThrow(IllegalEntityChangeError);
    });
  });

  describe("when trying to set numberOfLoadedEvents", () => {
    let aggregate: Aggregate<any>;

    beforeAll(() => {
      aggregate = new Aggregate({ ...aggregateIdentifier, eventHandlers: [] }, logger);
    });

    it("should throw", () => {
      expect(() => {
        aggregate.numberOfLoadedEvents = 2;
      }).toThrow(IllegalEntityChangeError);
    });
  });

  describe("when trying to set state", () => {
    let aggregate: Aggregate<any>;

    beforeAll(() => {
      aggregate = new Aggregate({ ...aggregateIdentifier, eventHandlers: [] }, logger);
    });

    it("should throw", () => {
      expect(() => {
        aggregate.state = {};
      }).toThrow(IllegalEntityChangeError);
    });
  });
});
