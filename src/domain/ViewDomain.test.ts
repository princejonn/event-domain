import MockDate from "mockdate";
import { DomainEvent } from "../message";
import { StoreType } from "../enum";
import { View } from "../entity";
import { ViewDomain } from "./ViewDomain";
import { ViewEventHandler } from "../handler";
import { logger } from "../test";
import {
  DomainError,
  HandlerNotRegisteredError,
  ViewAlreadyCreatedError,
  ViewNotCreatedError,
} from "../error";

MockDate.set("2022-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "e64b576a-022e-4dd4-8c97-32408012f8d1"),
}));

describe("ViewDomain", () => {
  describe("when registering an event handler", () => {
    let domain: ViewDomain<any>;

    beforeAll(async () => {
      domain = new ViewDomain<any>({ messageBus: {}, viewStore: {}, logger });

      await domain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: "name",
            context: "context",
          },
          view: {
            name: "name",
            context: "context",
          },
          eventName: "eventName",
          getViewId: (event) => event.aggregate.id,
          handler: async (ctx) => {
            ctx.setState("eventName", ctx.event.name);
          },
        }),
      );
    });

    it("should become part of the domain", () => {
      // @ts-ignore
      expect(domain.eventHandlers).toMatchSnapshot();
    });

    it("should add subscriptions to topic", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[0].topic).toMatchSnapshot();
    });

    it("should add event subscription", async () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[0].sub).toMatchSnapshot();
    });

    it("should add handler callback", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[0].callback).toStrictEqual(
        expect.any(Function),
      );
    });
  });

  describe("when registering an existing event handler", () => {
    let domain: ViewDomain<any>;

    beforeAll(async () => {
      domain = new ViewDomain<any>({ messageBus: {}, viewStore: {}, logger });

      await domain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: "name",
            context: "context",
          },
          view: {
            name: "name",
            context: "context",
          },
          eventName: "eventName",
          getViewId: (event) => event.aggregate.id,
          handler: async (ctx) => {
            ctx.setState("eventName", ctx.event.name);
          },
        }),
      );
    });

    it("should throw", async () => {
      await expect(
        domain.registerEventHandler(
          new ViewEventHandler({
            aggregate: {
              name: "name",
              context: "context",
            },
            view: {
              name: "name",
              context: "context",
            },
            eventName: "eventName",
            getViewId: (event) => event.aggregate.id,
            handler: async (ctx) => {
              ctx.setState("eventName", ctx.event.name);
            },
          }),
        ),
      ).rejects.toThrow(Error);
    });

    it("should not register a second handler on domain", () => {
      // @ts-ignore
      expect(domain.eventHandlers).toMatchSnapshot();
    });
  });

  describe("when registering an event handler to multiple contexts", () => {
    let domain: ViewDomain<any>;

    beforeAll(async () => {
      domain = new ViewDomain<any>({ messageBus: {}, viewStore: {}, logger });

      await domain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: "name",
            context: ["context", "secondary"],
          },
          view: {
            name: "name",
            context: "context",
          },
          eventName: "eventName",
          getViewId: (event) => event.aggregate.id,
          handler: async (ctx) => {
            ctx.setState("eventName", ctx.event.name);
          },
        }),
      );
    });

    it("should become part of the domain for each context", () => {
      // @ts-ignore
      expect(domain.eventHandlers).toMatchSnapshot();
    });

    it("should add subscriptions to topic", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[0].topic).toMatchSnapshot();
    });

    it("should add event subscription", async () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[0].sub).toMatchSnapshot();
    });

    it("should add handler callback", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[0].callback).toStrictEqual(
        expect.any(Function),
      );
    });
  });

  describe("when registering an event handler to multiple existing contexts", () => {
    let domain: ViewDomain<any>;

    beforeAll(async () => {
      domain = new ViewDomain<any>({ messageBus: {}, viewStore: {}, logger });

      await domain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: "name",
            context: ["context", "secondary"],
          },
          view: {
            name: "name",
            context: "context",
          },
          eventName: "eventName",
          getViewId: (event) => event.aggregate.id,
          handler: async (ctx) => {
            ctx.setState("eventName", ctx.event.name);
          },
        }),
      );
    });

    it("should throw", async () => {
      await expect(
        domain.registerEventHandler(
          new ViewEventHandler({
            aggregate: {
              name: "name",
              context: ["context", "secondary"],
            },
            view: {
              name: "name",
              context: "context",
            },
            eventName: "eventName",
            getViewId: (event) => event.aggregate.id,
            handler: async (ctx) => {
              ctx.setState("eventName", ctx.event.name);
            },
          }),
        ),
      ).rejects.toThrow(Error);
    });

    it("should become part of the domain only once for each context", () => {
      // @ts-ignore
      expect(domain.eventHandlers).toMatchSnapshot();
    });
  });

  describe("when handling an event", () => {
    let domain: ViewDomain<any>;
    const emitSpy = jest.fn();

    beforeAll(async () => {
      domain = new ViewDomain<any>({ messageBus: {}, viewStore: {}, logger });

      domain.on("error", (error) => {
        emitSpy({ error });
      });

      domain.on("event", (error, event, view) => {
        emitSpy({ error, event, view });
      });

      await domain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: "name",
            context: "context",
          },
          view: {
            name: "name",
            context: "context",
          },
          eventName: "eventName",
          getViewId: (event) => event.aggregate.id,
          handler: async (ctx) => {
            ctx.setState("data", ctx.event.data);
          },
        }),
      );
    });

    it("should resolve", async () => {
      await expect(
        // @ts-ignore
        domain.handleEvent(
          new DomainEvent({
            aggregate: {
              id: "id",
              name: "name",
              context: "context",
            },
            data: { data: "data" },
            name: "eventName",
          }),
          {
            name: "name",
            context: "context",
          },
        ),
      ).resolves.toBeUndefined();
    });

    it("should save the view to the view store", () => {
      // @ts-ignore
      expect(domain.viewStore.store.views).toMatchSnapshot();
    });

    it("should emit the handled event and view", () => {
      expect(emitSpy.mock.calls).toMatchSnapshot();
    });
  });

  describe("when handling an event twice", () => {
    let domain: ViewDomain<any>;
    const handlerSpy = jest.fn();

    beforeAll(async () => {
      domain = new ViewDomain<any>({ messageBus: {}, viewStore: {}, logger });

      await domain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: "name",
            context: "context",
          },
          view: {
            name: "name",
            context: "context",
          },
          eventName: "eventName",
          getViewId: (event) => event.aggregate.id,
          handler: async (ctx) => {
            ctx.setState("data", ctx.event.data);
            handlerSpy();
          },
        }),
      );
    });

    it("should resolve", async () => {
      await expect(
        // @ts-ignore
        domain.handleEvent(
          new DomainEvent({
            aggregate: {
              id: "id",
              name: "name",
              context: "context",
            },
            data: { data: "data" },
            name: "eventName",
          }),
          {
            name: "name",
            context: "context",
          },
        ),
      ).resolves.toBeUndefined();

      await expect(
        // @ts-ignore
        domain.handleEvent(
          new DomainEvent({
            aggregate: {
              id: "id",
              name: "name",
              context: "context",
            },
            data: { data: "data" },
            name: "eventName",
          }),
          {
            name: "name",
            context: "context",
          },
        ),
      ).resolves.toBeUndefined();
    });

    it("should save only one view to the view store", () => {
      // @ts-ignore
      expect(domain.viewStore.store.views).toMatchSnapshot();
    });

    it("should call the event handler only once", () => {
      expect(handlerSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("when handling an event without a matching event handler", () => {
    let domain: ViewDomain<any>;

    beforeAll(async () => {
      domain = new ViewDomain<any>({ messageBus: {}, viewStore: {}, logger });
    });

    it("should reject", async () => {
      await expect(
        // @ts-ignore
        domain.handleEvent(
          new DomainEvent({
            aggregate: {
              id: "id",
              name: "name",
              context: "context",
            },
            data: { data: "data" },
            name: "eventName",
          }),
          {
            name: "name",
            context: "context",
          },
        ),
      ).rejects.toThrow(HandlerNotRegisteredError);
    });
  });

  describe("when failing to handle an event", () => {
    let domain: ViewDomain<any>;
    const emitSpy = jest.fn();

    beforeAll(async () => {
      domain = new ViewDomain<any>({ messageBus: {}, viewStore: {}, logger });

      domain.on("error", (error) => {
        emitSpy({ error });
      });

      domain.on("event", (error, event, view) => {
        emitSpy({ error, event, view });
      });

      await domain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: "name",
            context: "context",
          },
          view: {
            name: "name",
            context: "context",
          },
          eventName: "eventName",
          getViewId: (event) => event.aggregate.id,
          handler: async (ctx) => {
            throw new Error("handler error");
          },
        }),
      );
    });

    it("should reject", async () => {
      await expect(
        // @ts-ignore
        domain.handleEvent(
          new DomainEvent({
            aggregate: {
              id: "id",
              name: "name",
              context: "context",
            },
            data: { data: "data" },
            name: "eventName",
          }),
          {
            name: "name",
            context: "context",
          },
        ),
      ).rejects.toThrow(Error);
    });

    it("should not save the view", () => {
      // @ts-ignore
      expect(domain.viewStore.store.views).toStrictEqual({});
    });

    it("should emit the error and not the event", () => {
      expect(emitSpy.mock.calls).toMatchSnapshot();
    });
  });

  describe("when failing to handle an event with a non-permanent domain error", () => {
    let domain: ViewDomain<any>;

    class TestError extends DomainError {
      public constructor() {
        super("handler error", { permanent: false });
      }
    }

    beforeAll(async () => {
      domain = new ViewDomain<any>({ messageBus: {}, viewStore: {}, logger });

      domain.on("error", () => {});
      domain.on("event", () => {});

      await domain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: "name",
            context: "context",
          },
          view: {
            name: "name",
            context: "context",
          },
          eventName: "eventName",
          getViewId: (event) => event.aggregate.id,
          handler: async (ctx) => {
            throw new TestError();
          },
        }),
      );
    });

    it("should reject", async () => {
      await expect(
        // @ts-ignore
        domain.handleEvent(
          new DomainEvent({
            aggregate: {
              id: "id",
              name: "name",
              context: "context",
            },
            data: { data: "data" },
            name: "eventName",
          }),
          {
            name: "name",
            context: "context",
          },
        ),
      ).rejects.toThrow(TestError);
    });

    it("should not save the view", () => {
      // @ts-ignore
      expect(domain.viewStore.store.views).toStrictEqual({});
    });
  });

  describe("when failing to handle an event with a permanent domain error", () => {
    let domain: ViewDomain<any>;

    class TestError extends DomainError {
      public constructor() {
        super("handler error", { permanent: true });
      }
    }

    beforeAll(async () => {
      domain = new ViewDomain<any>({ messageBus: {}, viewStore: {}, logger });

      domain.on("error", () => {});
      domain.on("event", () => {});

      await domain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: "name",
            context: "context",
          },
          view: {
            name: "name",
            context: "context",
          },
          eventName: "eventName",
          getViewId: (event) => event.aggregate.id,
          handler: async (ctx) => {
            throw new TestError();
          },
        }),
      );
    });

    it("should resolve", async () => {
      await expect(
        // @ts-ignore
        domain.handleEvent(
          new DomainEvent({
            aggregate: {
              id: "id",
              name: "name",
              context: "context",
            },
            data: { data: "data" },
            name: "eventName",
          }),
          {
            name: "name",
            context: "context",
          },
        ),
      ).resolves.toBeUndefined();
    });

    it("should not save the view", () => {
      // @ts-ignore
      expect(domain.viewStore.store.views).toStrictEqual({});
    });

    it("should publish non-mandatory error event to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published).toMatchSnapshot();
    });
  });

  describe("when handling an event on a destroyed domain", () => {
    let domain: ViewDomain<any>;
    const spySave = jest.fn();

    beforeAll(async () => {
      domain = new ViewDomain<any>({
        messageBus: {},
        viewStore: {
          type: StoreType.CUSTOM,
          custom: {
            load: async (viewIdentifier) => {
              return new View({ ...viewIdentifier, destroyed: true }, logger);
            },
            save: async (view) => {
              spySave(view);
              return new View({ ...view, revision: view.revision + 1 }, logger);
            },
            query: async () => {
              return [new View({ id: "id", name: "name", context: "context" }, logger)];
            },
          },
        },
        logger,
      });

      domain.on("error", () => {});
      domain.on("event", () => {});

      await domain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: "name",
            context: "context",
          },
          view: {
            name: "name",
            context: "context",
          },
          eventName: "eventName",
          getViewId: (event) => event.aggregate.id,
          handler: async (ctx) => {
            ctx.setState("data", ctx.event.data);
          },
        }),
      );
    });

    it("should resolve", async () => {
      await expect(
        // @ts-ignore
        domain.handleEvent(
          new DomainEvent({
            aggregate: {
              id: "id",
              name: "name",
              context: "context",
            },
            data: { data: "data" },
            name: "eventName",
          }),
          {
            name: "name",
            context: "context",
          },
        ),
      ).resolves.toBeUndefined();
    });

    it("should not save the view", () => {
      expect(spySave).not.toHaveBeenCalled();
    });

    it("should publish ViewAlreadyDestroyedError to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published).toMatchSnapshot();
    });
  });

  describe("when handling an event with a created [true] condition", () => {
    let domain: ViewDomain<any>;
    const spySave = jest.fn();

    beforeAll(async () => {
      domain = new ViewDomain<any>({
        messageBus: {},
        viewStore: {
          type: StoreType.CUSTOM,
          custom: {
            load: async () => {
              return null;
            },
            save: async (view) => {
              spySave(view);
              return new View({ ...view, revision: view.revision + 1 }, logger);
            },
            query: async () => {
              return [new View({ id: "id", name: "name", context: "context" }, logger)];
            },
          },
        },
        logger,
      });

      domain.on("error", () => {});
      domain.on("event", () => {});

      await domain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: "name",
            context: "context",
          },
          conditions: {
            created: true,
          },
          view: {
            name: "name",
            context: "context",
          },
          eventName: "eventName",
          getViewId: (event) => event.aggregate.id,
          handler: async (ctx) => {
            ctx.setState("data", ctx.event.data);
          },
        }),
      );
    });

    it("should reject with a transient ViewNotCreatedError", async () => {
      await expect(
        // @ts-ignore
        domain.handleEvent(
          new DomainEvent({
            aggregate: {
              id: "id",
              name: "name",
              context: "context",
            },
            data: { data: "data" },
            name: "eventName",
          }),
          {
            name: "name",
            context: "context",
          },
        ),
      ).rejects.toThrow(ViewNotCreatedError);
    });
  });

  describe("when handling an event with a created [true] and permanent [true] condition", () => {
    let domain: ViewDomain<any>;
    const spySave = jest.fn();

    beforeAll(async () => {
      domain = new ViewDomain<any>({
        messageBus: {},
        viewStore: {
          type: StoreType.CUSTOM,
          custom: {
            load: async () => {
              return null;
            },
            save: async (view) => {
              spySave(view);
              return new View({ ...view, revision: view.revision + 1 }, logger);
            },
            query: async () => {
              return [new View({ id: "id", name: "name", context: "context" }, logger)];
            },
          },
        },
        logger,
      });

      domain.on("error", () => {});
      domain.on("event", () => {});

      await domain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: "name",
            context: "context",
          },
          conditions: {
            created: true,
            permanent: true,
          },
          view: {
            name: "name",
            context: "context",
          },
          eventName: "eventName",
          getViewId: (event) => event.aggregate.id,
          handler: async (ctx) => {
            ctx.setState("data", ctx.event.data);
          },
        }),
      );
    });

    it("should resolve", async () => {
      await expect(
        // @ts-ignore
        domain.handleEvent(
          new DomainEvent({
            aggregate: {
              id: "id",
              name: "name",
              context: "context",
            },
            data: { data: "data" },
            name: "eventName",
          }),
          {
            name: "name",
            context: "context",
          },
        ),
      ).resolves.toBeUndefined();
    });

    it("should not save the view", () => {
      expect(spySave).not.toHaveBeenCalled();
    });

    it("should publish ViewNotCreatedError to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published).toMatchSnapshot();
    });
  });

  describe("when handling an event with a created [false] condition", () => {
    let domain: ViewDomain<any>;
    const spySave = jest.fn();

    beforeAll(async () => {
      domain = new ViewDomain<any>({
        messageBus: {},
        viewStore: {
          type: StoreType.CUSTOM,
          custom: {
            load: async (viewIdentifier) => {
              return new View({ ...viewIdentifier, revision: 1 }, logger);
            },
            save: async (view) => {
              spySave(view);
              return new View({ ...view, revision: view.revision + 1 }, logger);
            },
            query: async () => {
              return [new View({ id: "id", name: "name", context: "context" }, logger)];
            },
          },
        },
        logger,
      });

      domain.on("error", () => {});
      domain.on("event", () => {});

      await domain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: "name",
            context: "context",
          },
          conditions: {
            created: false,
          },
          view: {
            name: "name",
            context: "context",
          },
          eventName: "eventName",
          getViewId: (event) => event.aggregate.id,
          handler: async (ctx) => {
            ctx.setState("data", ctx.event.data);
          },
        }),
      );
    });

    it("should resolve", async () => {
      await expect(
        // @ts-ignore
        domain.handleEvent(
          new DomainEvent({
            aggregate: {
              id: "id",
              name: "name",
              context: "context",
            },
            data: { data: "data" },
            name: "eventName",
          }),
          {
            name: "name",
            context: "context",
          },
        ),
      ).resolves.toBeUndefined();
    });

    it("should not save the view", () => {
      expect(spySave).not.toHaveBeenCalled();
    });

    it("should publish ViewAlreadyCreatedError to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published).toMatchSnapshot();
    });
  });

  describe("when handling an event with a created [false] and permanent [false] condition", () => {
    let domain: ViewDomain<any>;

    beforeAll(async () => {
      domain = new ViewDomain<any>({
        messageBus: {},
        viewStore: {
          type: StoreType.CUSTOM,
          custom: {
            load: async (viewIdentifier) => {
              return new View({ ...viewIdentifier, revision: 1 }, logger);
            },
            save: async (view) => {
              return new View({ ...view, revision: view.revision + 1 }, logger);
            },
            query: async () => {
              return [new View({ id: "id", name: "name", context: "context" }, logger)];
            },
          },
        },
        logger,
      });

      domain.on("error", () => {});
      domain.on("event", () => {});

      await domain.registerEventHandler(
        new ViewEventHandler({
          aggregate: {
            name: "name",
            context: "context",
          },
          conditions: {
            created: false,
            permanent: false,
          },
          view: {
            name: "name",
            context: "context",
          },
          eventName: "eventName",
          getViewId: (event) => event.aggregate.id,
          handler: async (ctx) => {
            ctx.setState("data", ctx.event.data);
          },
        }),
      );
    });

    it("should reject with a transient ViewAlreadyCreatedError", async () => {
      await expect(
        // @ts-ignore
        domain.handleEvent(
          new DomainEvent({
            aggregate: {
              id: "id",
              name: "name",
              context: "context",
            },
            data: { data: "data" },
            name: "eventName",
          }),
          {
            name: "name",
            context: "context",
          },
        ),
      ).rejects.toThrow(ViewAlreadyCreatedError);
    });
  });
});
