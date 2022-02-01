import Joi from "joi";
import MockDate from "mockdate";
import { AggregateCommandHandler, AggregateEventHandler } from "../handler";
import { AggregateDomain } from "./AggregateDomain";
import { Command } from "../message";
import { MessageBusType } from "../enum";
import {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
  CommandSchemaValidationError,
  DomainError,
  HandlerNotRegisteredError,
} from "../error";
import {
  aggregateIdentifier,
  commandHandlerWithCreated,
  commandHandlerWithData,
  commandHandlerWithDestroy,
  commandHandlerWithNotCreated,
  commandWithCreated,
  commandWithData,
  commandWithDestroy,
  commandWithNotCreated,
  eventHandlerWithData,
  eventHandlerWithDestroy,
  eventHandlerWithNotCreated,
  eventWithData,
  logger,
} from "../test";

MockDate.set("2022-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "e64b576a-022e-4dd4-8c97-32408012f8d1"),
}));

describe("AggregateDomain", () => {
  describe("when registering a command handler", () => {
    let domain: AggregateDomain<any>;

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerCommandHandler(
        new AggregateCommandHandler({
          commandName: commandWithData.name,
          aggregate: aggregateIdentifier,
          // @ts-ignore
          schema: "Joi.object()",
          handler: async (ctx) => {
            await ctx.apply(eventWithData.name, ctx.command.data);
          },
        }),
      );
    });

    it("should become part of the domain", () => {
      // @ts-ignore
      expect(domain.commandHandlers).toMatchSnapshot();
    });

    it("should add subscriptions to topic", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[0].topic).toMatchSnapshot();
    });

    it("should add command subscription", async () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[0].sub).toMatchSnapshot();
    });

    it("should add handler callback", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[0].callback).toStrictEqual(expect.any(Function));
    });
  });

  describe("when registering an existing command handler", () => {
    let domain: AggregateDomain<any>;

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerCommandHandler(commandHandlerWithData);
    });

    it("should throw", async () => {
      await expect(domain.registerCommandHandler(commandHandlerWithData)).rejects.toThrow();
    });
  });

  describe("when registering an event handler", () => {
    let domain: AggregateDomain<any>;

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerEventHandler(eventHandlerWithData);
    });

    it("should become part of the domain", () => {
      // @ts-ignore
      expect(domain.eventHandlers).toMatchSnapshot();
    });
  });

  describe("when registering an existing event handler", () => {
    let domain: AggregateDomain<any>;

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerEventHandler(eventHandlerWithData);
    });

    it("should throw", async () => {
      await expect(domain.registerEventHandler(eventHandlerWithData)).rejects.toThrow();
    });
  });

  describe("when handling a command", () => {
    let domain: AggregateDomain<any>;

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerCommandHandler(commandHandlerWithData);
      await domain.registerEventHandler(eventHandlerWithData);

      // @ts-ignore
      await domain.handleCommand(commandWithData);
    });

    it("should attempt to save events to store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.saveAttempts).toMatchSnapshot();
    });

    it("should save applied events to event store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.eventsByAggregate).toMatchSnapshot();
    });

    it("should publish applied events to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published).toMatchSnapshot();
    });
  });

  describe("when handling the same command twice", () => {
    let domain: AggregateDomain<any>;

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerCommandHandler(commandHandlerWithData);
      await domain.registerEventHandler(eventHandlerWithData);

      // @ts-ignore
      await domain.handleCommand(commandWithData);

      // @ts-ignore
      await domain.handleCommand(commandWithData);
    });

    it("should attempt to save command events to store twice", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.saveAttempts).toMatchSnapshot();
    });

    it("should save applied events to event store once", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.eventsByAggregate).toMatchSnapshot();
    });

    it("should publish applied events to message bus twice", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published).toMatchSnapshot();
    });
  });

  describe("when no command handler has been registered", () => {
    let domain: AggregateDomain<any>;

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerEventHandler(eventHandlerWithData);
    });

    it("should throw HandlerNotRegisteredError", async () => {
      // @ts-ignore
      await expect(domain.handleCommand(commandWithData)).rejects.toThrow(HandlerNotRegisteredError);
    });
  });

  describe("when aggregate is already destroyed", () => {
    let domain: AggregateDomain<any>;

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerCommandHandler(commandHandlerWithData);
      await domain.registerEventHandler(eventHandlerWithData);

      await domain.registerCommandHandler(commandHandlerWithDestroy);
      await domain.registerEventHandler(eventHandlerWithDestroy);

      // @ts-ignore
      await domain.handleCommand(commandWithDestroy);
    });

    it("should throw", async () => {
      // @ts-ignore
      await expect(domain.handleCommand(commandWithData)).rejects.toThrow(AggregateDestroyedError);
    });

    it("should not save events to event store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.eventsByAggregate[1]).toBe(undefined);
    });

    it("should publish a rejected command event to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[1].aggregate).toStrictEqual(aggregateIdentifier);
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[1].data.error).toStrictEqual(expect.any(AggregateDestroyedError));
    });
  });

  describe("when command data is invalid according to schema", () => {
    let domain: AggregateDomain<any>;

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerCommandHandler(
        new AggregateCommandHandler({
          commandName: "commandWithSchemaError",
          aggregate: aggregateIdentifier,
          schema: Joi.object({ name: Joi.string() }),
          handler: async (ctx) => {
            await ctx.apply("eventWithSchemaError", ctx.command.data);
          },
        }),
      );
      await domain.registerEventHandler(
        new AggregateEventHandler({
          eventName: "eventWithSchemaError",
          aggregate: aggregateIdentifier,
          handler: async (ctx) => {
            ctx.mergeState(ctx.event.data);
          },
        }),
      );
    });

    it("should throw", async () => {
      await expect(
        // @ts-ignore
        domain.handleCommand(
          new Command({
            id: "e1f8b713-16e2-40aa-b932-704e2bce2137",
            name: "commandWithSchemaError",
            aggregate: aggregateIdentifier,
            data: { wrong: "wrong" },
          }),
        ),
      ).rejects.toThrow(CommandSchemaValidationError);
    });

    it("should publish a rejected command event to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].name).toBe("CommandSchemaValidationError");
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].causationId).toBe("e1f8b713-16e2-40aa-b932-704e2bce2137");
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].aggregate).toStrictEqual(aggregateIdentifier);
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].data.message.id).toBe("e1f8b713-16e2-40aa-b932-704e2bce2137");
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].data.error).toStrictEqual(
        expect.any(CommandSchemaValidationError),
      );
    });
  });

  describe("when expecting created and aggregate is not created", () => {
    let domain: AggregateDomain<any>;

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerCommandHandler(commandHandlerWithCreated);
      await domain.registerEventHandler(eventHandlerWithData);
    });

    it("should throw", async () => {
      // @ts-ignore
      await expect(domain.handleCommand(commandWithCreated)).rejects.toThrow(AggregateNotCreatedError);
    });

    it("should publish a rejected command event to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].name).toBe("AggregateNotCreatedError");
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].causationId).toBe(commandWithCreated.id);
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].aggregate).toStrictEqual(aggregateIdentifier);
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].data.message.id).toBe(commandWithCreated.id);
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].data.error).toStrictEqual(expect.any(AggregateNotCreatedError));
    });
  });

  describe("when expecting not created and aggregate is created", () => {
    let domain: AggregateDomain<any>;

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerCommandHandler(commandHandlerWithData);
      await domain.registerCommandHandler(commandHandlerWithNotCreated);
      await domain.registerEventHandler(eventHandlerWithData);
      await domain.registerEventHandler(eventHandlerWithNotCreated);

      // @ts-ignore
      await domain.handleCommand(commandWithData);
    });

    it("should throw", async () => {
      // @ts-ignore
      await expect(domain.handleCommand(commandWithNotCreated)).rejects.toThrow(AggregateAlreadyCreatedError);
    });

    it("should publish a rejected command event to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[1].name).toBe("AggregateAlreadyCreatedError");
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[1].causationId).toBe(commandWithNotCreated.id);
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[1].aggregate).toStrictEqual(aggregateIdentifier);
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[1].data.message.id).toBe(commandWithNotCreated.id);
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[1].data.error).toStrictEqual(
        expect.any(AggregateAlreadyCreatedError),
      );
    });
  });

  describe("when failing to publish events", () => {
    let domain: AggregateDomain<any>;

    beforeAll(async () => {
      domain = new AggregateDomain({
        eventStore: {},
        messageBus: {
          type: MessageBusType.CUSTOM,
          custom: {
            async publish(messages: any): Promise<void> {
              throw new Error("PublishError");
            },
            async subscribe(subscription: any): Promise<void> {},
          },
        },
        logger,
      });

      await domain.registerCommandHandler(commandHandlerWithData);
      await domain.registerEventHandler(eventHandlerWithData);
    });

    it("should throw", async () => {
      // @ts-ignore
      await expect(domain.handleCommand(commandWithData)).rejects.toThrow(Error("PublishError"));
    });

    it("should attempt to save events to store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.saveAttempts).toMatchSnapshot();
    });

    it("should save applied events to event store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.eventsByAggregate).toMatchSnapshot();
    });
  });

  describe("when command handler throws an error", () => {
    let domain: AggregateDomain<any>;

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerCommandHandler(
        new AggregateCommandHandler({
          commandName: "commandWithHandlerError",
          aggregate: aggregateIdentifier,
          schema: Joi.object({}),
          handler: async (ctx) => {
            await ctx.apply("eventWithHandlerError", ctx.command.data);
          },
        }),
      );
      await domain.registerEventHandler(
        new AggregateEventHandler({
          eventName: "eventWithHandlerError",
          aggregate: aggregateIdentifier,
          handler: async () => {
            throw new Error("HandlerError");
          },
        }),
      );
    });

    it("should throw", async () => {
      await expect(
        // @ts-ignore
        domain.handleCommand(
          new Command({
            name: "commandWithHandlerError",
            aggregate: aggregateIdentifier,
          }),
        ),
      ).rejects.toThrow(Error("HandlerError"));
    });

    it("should not attempt to save events to store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.saveAttempts[0]).toBe(undefined);
    });

    it("should not save events to event store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.eventsByAggregate).toStrictEqual({});
    });

    it("should not publish events to event store", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0]).toBe(undefined);
    });
  });

  describe("when command handler throws a permanent domain error", () => {
    let domain: AggregateDomain<any>;

    class PermanentDomainError extends DomainError {
      constructor() {
        super("error", { permanent: true });
      }
    }

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerCommandHandler(
        new AggregateCommandHandler({
          commandName: "commandWithPermanentDomainError",
          aggregate: aggregateIdentifier,
          schema: Joi.object({}),
          handler: async () => {
            throw new PermanentDomainError();
          },
        }),
      );
      await domain.registerEventHandler(
        new AggregateEventHandler({
          eventName: "eventWithPermanentDomainError",
          aggregate: aggregateIdentifier,
          handler: async () => {},
        }),
      );
    });

    it("should throw", async () => {
      await expect(
        // @ts-ignore
        domain.handleCommand(
          new Command({
            id: "ad3376a2-5b0f-453f-87e0-75c96ac0583a",
            name: "commandWithPermanentDomainError",
            aggregate: aggregateIdentifier,
          }),
        ),
      ).rejects.toThrow(PermanentDomainError);
    });

    it("should not attempt to save events to store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.saveAttempts[0]).toBe(undefined);
    });

    it("should not save events to event store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.eventsByAggregate).toStrictEqual({});
    });

    it("should publish a rejected command event to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].name).toBe("PermanentDomainError");
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].causationId).toBe("ad3376a2-5b0f-453f-87e0-75c96ac0583a");
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].aggregate).toStrictEqual(aggregateIdentifier);
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].data.message.id).toBe("ad3376a2-5b0f-453f-87e0-75c96ac0583a");
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].data.error).toStrictEqual(expect.any(PermanentDomainError));
    });
  });

  describe("when command handler throws a non-permanent domain error", () => {
    let domain: AggregateDomain<any>;

    class NonPermanentDomainError extends DomainError {
      constructor() {
        super("error", { permanent: false });
      }
    }

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerCommandHandler(
        new AggregateCommandHandler({
          commandName: "commandWithNonPermanentDomainError",
          aggregate: aggregateIdentifier,
          schema: Joi.object({}),
          handler: async () => {
            throw new NonPermanentDomainError();
          },
        }),
      );
      await domain.registerEventHandler(
        new AggregateEventHandler({
          eventName: "eventWithNonPermanentDomainError",
          aggregate: aggregateIdentifier,
          handler: async () => {},
        }),
      );
    });

    it("should throw", async () => {
      await expect(
        // @ts-ignore
        domain.handleCommand(
          new Command({
            name: "commandWithNonPermanentDomainError",
            aggregate: aggregateIdentifier,
          }),
        ),
      ).rejects.toThrow(NonPermanentDomainError);
    });

    it("should not attempt to save events to store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.saveAttempts[0]).toBe(undefined);
    });

    it("should not save events to event store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.eventsByAggregate).toStrictEqual({});
    });

    it("should not publish events to event store", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0]).toBe(undefined);
    });
  });

  describe("when event handler throws an error", () => {
    let domain: AggregateDomain<any>;

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerCommandHandler(
        new AggregateCommandHandler({
          commandName: "commandWithEventError",
          aggregate: aggregateIdentifier,
          schema: Joi.object({}),
          handler: async (ctx) => {
            await ctx.apply("eventWithEventError", ctx.command.data);
          },
        }),
      );
      await domain.registerEventHandler(
        new AggregateEventHandler({
          eventName: "eventWithEventError",
          aggregate: aggregateIdentifier,
          handler: async () => {
            throw new Error("EventError");
          },
        }),
      );
    });

    it("should throw", async () => {
      await expect(
        // @ts-ignore
        domain.handleCommand(
          new Command({
            name: "commandWithEventError",
            aggregate: aggregateIdentifier,
          }),
        ),
      ).rejects.toThrow(Error("EventError"));
    });

    it("should not attempt to save events to store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.saveAttempts[0]).toBe(undefined);
    });

    it("should not save events to event store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.eventsByAggregate).toStrictEqual({});
    });

    it("should not publish events to event store", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0]).toBe(undefined);
    });
  });

  describe("when event handler throws a permanent domain error", () => {
    let domain: AggregateDomain<any>;

    class PermanentDomainError extends DomainError {
      constructor() {
        super("error", { permanent: true });
      }
    }

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerCommandHandler(
        new AggregateCommandHandler({
          commandName: "commandWithPermanentDomainError",
          aggregate: aggregateIdentifier,
          schema: Joi.object({}),
          handler: async (ctx) => {
            await ctx.apply("eventWithPermanentDomainError", ctx.command.data);
          },
        }),
      );
      await domain.registerEventHandler(
        new AggregateEventHandler({
          eventName: "eventWithPermanentDomainError",
          aggregate: aggregateIdentifier,
          handler: async () => {
            throw new PermanentDomainError();
          },
        }),
      );
    });

    it("should throw", async () => {
      await expect(
        // @ts-ignore
        domain.handleCommand(
          new Command({
            id: "ad3376a2-5b0f-453f-87e0-75c96ac0583a",
            name: "commandWithPermanentDomainError",
            aggregate: aggregateIdentifier,
          }),
        ),
      ).rejects.toThrow(PermanentDomainError);
    });

    it("should not attempt to save events to store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.saveAttempts[0]).toBe(undefined);
    });

    it("should not save events to event store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.eventsByAggregate).toStrictEqual({});
    });

    it("should publish a rejected command event to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].name).toBe("PermanentDomainError");
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].causationId).toBe("ad3376a2-5b0f-453f-87e0-75c96ac0583a");
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].aggregate).toStrictEqual(aggregateIdentifier);
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].data.message.id).toBe("ad3376a2-5b0f-453f-87e0-75c96ac0583a");
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0].data.error).toStrictEqual(expect.any(PermanentDomainError));
    });
  });

  describe("when event handler throws a non-permanent domain error", () => {
    let domain: AggregateDomain<any>;

    class NonPermanentDomainError extends DomainError {
      constructor() {
        super("error", { permanent: false });
      }
    }

    beforeAll(async () => {
      domain = new AggregateDomain({ eventStore: {}, messageBus: {}, logger });

      await domain.registerCommandHandler(
        new AggregateCommandHandler({
          commandName: "commandWithNonPermanentDomainError",
          aggregate: aggregateIdentifier,
          schema: Joi.object({}),
          handler: async (ctx) => {
            await ctx.apply("eventWithNonPermanentDomainError", ctx.command.data);
          },
        }),
      );
      await domain.registerEventHandler(
        new AggregateEventHandler({
          eventName: "eventWithNonPermanentDomainError",
          aggregate: aggregateIdentifier,
          handler: async () => {
            throw new NonPermanentDomainError();
          },
        }),
      );
    });

    it("should throw", async () => {
      await expect(
        // @ts-ignore
        domain.handleCommand(
          new Command({
            name: "commandWithNonPermanentDomainError",
            aggregate: aggregateIdentifier,
          }),
        ),
      ).rejects.toThrow(NonPermanentDomainError);
    });

    it("should not attempt to save events to store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.saveAttempts[0]).toBe(undefined);
    });

    it("should not save events to event store", () => {
      // @ts-ignore
      expect(domain.eventStore.eventStore.eventsByAggregate).toStrictEqual({});
    });

    it("should not publish events to event store", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0]).toBe(undefined);
    });
  });
});
