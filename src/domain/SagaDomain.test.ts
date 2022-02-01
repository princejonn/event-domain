import MockDate from "mockdate";
import { SagaDomain } from "./SagaDomain";
import { Saga } from "../entity";
import {
  aggregateIdentifier,
  commandWithCreated,
  commandWithData,
  eventWithData,
  eventWithDispatch,
  eventWithSaveOptions,
  logger,
  sagaHandlerWithData,
  sagaHandlerWithDispatch,
  sagaHandlerWithMultipleContext,
  sagaHandlerWithSaveOptions,
  sagaIdentifier,
} from "../test";
import { SagaEventHandler } from "../handler";
import { Command, Message } from "../message";
import {
  DomainError,
  HandlerNotRegisteredError,
  SagaAlreadyCreatedError,
  SagaNotCreatedError,
} from "../error";
import { MessageBusType, StoreType } from "../enum";
import { Subscription } from "../types";

MockDate.set("2022-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "e64b576a-022e-4dd4-8c97-32408012f8d1"),
}));

describe("SagaDomain", () => {
  describe("when registering an event handler", () => {
    let domain: SagaDomain<any>;

    beforeAll(async () => {
      domain = new SagaDomain({ sagaStore: {}, messageBus: {}, logger });

      await domain.registerEventHandler(sagaHandlerWithData);
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

  describe("when registering an event handler with multiple contexts", () => {
    let domain: SagaDomain<any>;

    beforeAll(async () => {
      domain = new SagaDomain({ sagaStore: {}, messageBus: {}, logger });

      await domain.registerEventHandler(sagaHandlerWithMultipleContext);
    });

    it("should become part of the domain for each context", () => {
      // @ts-ignore
      expect(domain.eventHandlers).toMatchSnapshot();
    });

    it("should add subscriptions to topic for each context", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[0].topic).toMatchSnapshot();
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[1].topic).toMatchSnapshot();
    });

    it("should add event subscription for each context", async () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[0].sub).toMatchSnapshot();
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[1].sub).toMatchSnapshot();
    });

    it("should add handler callback for each context", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[0].callback).toStrictEqual(
        expect.any(Function),
      );
      // @ts-ignore
      expect(domain.messageBus.messageBus.subscriptions[1].callback).toStrictEqual(
        expect.any(Function),
      );
    });
  });

  describe("when registering an existing event handler", () => {
    let domain: SagaDomain<any>;

    beforeAll(async () => {
      domain = new SagaDomain({ sagaStore: {}, messageBus: {}, logger });

      await domain.registerEventHandler(sagaHandlerWithData);
    });

    it("should throw", async () => {
      await expect(domain.registerEventHandler(sagaHandlerWithData)).rejects.toThrow();
    });
  });

  describe("when handling an event", () => {
    let domain: SagaDomain<any>;

    beforeAll(async () => {
      domain = new SagaDomain({ sagaStore: {}, messageBus: {}, logger });

      const customHandler = new SagaEventHandler({
        eventName: eventWithData.name,
        aggregate: aggregateIdentifier,
        saga: sagaIdentifier,
        getSagaId: () => "customEventId",
        handler: async (ctx) => {
          ctx.mergeState({ customEvent: true });
        },
      });
      await domain.registerEventHandler(customHandler);

      // @ts-ignore
      await domain.handleEvent(eventWithData, sagaIdentifier);
    });

    it("should use getSagaId on handler to generate id", () => {
      expect(
        // @ts-ignore
        domain.sagaStore.sagaStore.sagas["defaultContext.sagaName.customEventId"].id,
      ).toStrictEqual("customEventId");
    });
  });

  describe("when handling an event on a new saga", () => {
    let domain: SagaDomain<any>;

    beforeAll(async () => {
      domain = new SagaDomain({ sagaStore: {}, messageBus: {}, logger });

      await domain.registerEventHandler(sagaHandlerWithDispatch);

      // @ts-ignore
      await domain.handleEvent(eventWithDispatch, sagaIdentifier);
    });

    it("should save the dispatched commands to saga store", () => {
      expect(
        // @ts-ignore
        domain.sagaStore.sagaStore.saveAttempts[0].saga.messagesToDispatch[0],
      ).toMatchSnapshot();
    });

    it("should publish the dispatched commands to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0]).toMatchSnapshot();
    });

    it("should clear the dispatched commands from saga store", () => {
      // @ts-ignore
      expect(domain.sagaStore.sagaStore.clearAttempts[0]).toStrictEqual(expect.any(Saga));
    });

    it("should resolve the promise with a saga that has a cleared list of commands", () => {
      // @ts-ignore
      expect(domain.sagaStore.sagaStore.sagas).toMatchSnapshot();
    });
  });

  describe("when handling an event with store options", () => {
    let domain: SagaDomain<any>;

    beforeAll(async () => {
      domain = new SagaDomain({ sagaStore: {}, messageBus: {}, logger });

      await domain.registerEventHandler(sagaHandlerWithSaveOptions);

      // @ts-ignore
      await domain.handleEvent(eventWithSaveOptions, sagaIdentifier);
    });

    it("should pass the store options to the saga store", () => {
      // @ts-ignore
      expect(domain.sagaStore.sagaStore.saveAttempts[0].options).toStrictEqual({
        causationsCap: 100,
      });
    });
  });

  describe("when handling an event twice", () => {
    let domain: SagaDomain<any>;

    const handlerSpy = jest.fn();

    beforeAll(async () => {
      domain = new SagaDomain({ sagaStore: {}, messageBus: {}, logger });

      const customHandler = new SagaEventHandler({
        eventName: eventWithDispatch.name,
        aggregate: aggregateIdentifier,
        saga: sagaIdentifier,
        getSagaId: (event) => event.aggregate.id,
        handler: async (ctx) => {
          handlerSpy();
          ctx.dispatch(
            new Command({
              name: "commandDispatchFromHandler",
              aggregate: aggregateIdentifier,
            }),
          );
        },
      });

      await domain.registerEventHandler(customHandler);

      // @ts-ignore
      await domain.handleEvent(eventWithDispatch, sagaIdentifier);
      // @ts-ignore
      await domain.handleEvent(eventWithDispatch, sagaIdentifier);
    });

    it("should call the event handler once", () => {
      expect(handlerSpy).toHaveBeenCalledTimes(1);
    });

    it("should save the dispatched commands to saga store once", () => {
      // @ts-ignore
      expect(domain.sagaStore.sagaStore.saveAttempts.length).toBe(1);
    });

    it("should publish the dispatched commands to message bus once", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published.length).toBe(1);
    });

    it("should clear the dispatched commands to saga store once", () => {
      // @ts-ignore
      expect(domain.sagaStore.sagaStore.clearAttempts.length).toBe(1);
    });
  });

  describe("when handling an event and failing to publish commands", () => {
    let test: any = {};
    let domain: SagaDomain<any>;

    beforeAll(async () => {
      domain = new SagaDomain({
        messageBus: {
          type: MessageBusType.CUSTOM,
          custom: {
            subscribe: async (subscription: Subscription) => {
              test.subscribe = { subscription };
            },
            publish: async (messages: Array<Message>) => {
              test.publish = { messages };
              throw new Error("custom");
            },
          },
        },
        sagaStore: {},
        logger,
      });

      await domain.registerEventHandler(sagaHandlerWithDispatch);
    });

    it("should reject command", async () => {
      // @ts-ignore
      await expect(domain.handleEvent(eventWithDispatch, sagaIdentifier)).rejects.toThrow(
        new Error("custom"),
      );
    });

    it("should save dispatched commands to saga store", async () => {
      // @ts-ignore
      expect(domain.sagaStore.sagaStore.saveAttempts).toMatchSnapshot();
    });

    it("should publish the dispatched commands to message bus", async () => {
      expect(test.publish).toMatchSnapshot();
    });
  });

  describe("when handling an event for a destroyed saga", () => {
    let test: any = {};
    let domain: SagaDomain<any>;

    beforeAll(async () => {
      domain = new SagaDomain({
        sagaStore: {
          type: StoreType.CUSTOM,
          custom: {
            load: async (sagaIdentifier) => {
              test.load = { sagaIdentifier };
              return new Saga<any>(
                {
                  id: "2a553a74-0f84-4a7d-b91e-2902666db98c",
                  name: "sagaName",
                  context: "defaultContext",
                  destroyed: true,
                },
                logger,
              );
            },
            save: async (saga, causation, options?) => {
              test.save = { saga, causation, options };
              return saga;
            },
            clearMessagesToDispatch: async (saga) => {
              test.clearMessagesToDispatch = { saga };
              return new Saga({ ...saga, messagesToDispatch: [] }, logger);
            },
          },
        },
        messageBus: {},
        logger,
      });

      await domain.registerEventHandler(sagaHandlerWithData);

      // @ts-ignore
      await domain.handleEvent(eventWithData, sagaIdentifier);
    });

    it("should not save the saga", () => {
      expect(test.save).toBeUndefined();
    });
  });

  describe("when handling an event with created [true] condition", () => {
    let domain: SagaDomain<any>;

    beforeAll(async () => {
      domain = new SagaDomain({ sagaStore: {}, messageBus: {}, logger });

      const customHandler = new SagaEventHandler({
        eventName: eventWithData.name,
        aggregate: aggregateIdentifier,
        saga: sagaIdentifier,
        conditions: {
          created: true,
        },
        getSagaId: () => "customEventId",
        handler: async (ctx) => {
          ctx.mergeState({ customEvent: true });
        },
      });
      await domain.registerEventHandler(customHandler);
    });

    it("should reject the promise with a transient SagaNotCreatedError", async () => {
      // @ts-ignore
      await expect(domain.handleEvent(eventWithData, sagaIdentifier)).rejects.toThrow(
        SagaNotCreatedError,
      );
    });
  });

  describe("when handling an event with created [true] and permanent [true] condition", () => {
    let domain: SagaDomain<any>;

    beforeAll(async () => {
      domain = new SagaDomain({ sagaStore: {}, messageBus: {}, logger });

      const customHandler = new SagaEventHandler({
        eventName: eventWithData.name,
        aggregate: aggregateIdentifier,
        saga: sagaIdentifier,
        conditions: {
          created: true,
          permanent: true,
        },
        getSagaId: () => "customEventId",
        handler: async (ctx) => {
          ctx.mergeState({ customEvent: true });
        },
      });

      await domain.registerEventHandler(customHandler);
      await domain.registerEventHandler(sagaHandlerWithDispatch);

      // @ts-ignore
      await domain.handleEvent(eventWithDispatch, sagaIdentifier);
    });

    it("should resolve", async () => {
      await expect(
        // @ts-ignore
        domain.handleEvent(eventWithData, sagaIdentifier),
      ).resolves.toBeUndefined();
    });

    it("should not save the saga", () => {
      // @ts-ignore
      expect(domain.sagaStore.sagaStore.saveAttempts.length).toBe(1);
    });

    it("should publish SagaNotCreatedError", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "SagaNotCreatedError",
          }),
        ]),
      );
    });
  });

  describe("when handling an event with created [false] condition", () => {
    let test: any = {};
    let domain: SagaDomain<any>;

    const clearSpy = jest.fn();

    beforeAll(async () => {
      domain = new SagaDomain({
        sagaStore: {
          type: StoreType.CUSTOM,
          custom: {
            load: async (sagaIdentifier) => {
              test.load = { sagaIdentifier };
              return new Saga<any>(
                {
                  id: "2a553a74-0f84-4a7d-b91e-2902666db98c",
                  name: "sagaName",
                  context: "defaultContext",
                  messagesToDispatch: [commandWithData],
                  revision: 1,
                },
                logger,
              );
            },
            save: async (saga, causation, options?) => {
              test.save = { saga, causation, options };
              return saga;
            },
            clearMessagesToDispatch: async (saga) => {
              clearSpy(saga);
              test.clearMessagesToDispatch = { saga };
              return new Saga({ ...saga, messagesToDispatch: [] }, logger);
            },
          },
        },
        messageBus: {},
        logger,
      });

      const customHandler = new SagaEventHandler({
        eventName: eventWithData.name,
        aggregate: aggregateIdentifier,
        saga: sagaIdentifier,
        conditions: {
          created: false,
        },
        getSagaId: () => "customEventId",
        handler: async (ctx) => {
          ctx.mergeState({ customEvent: true });
        },
      });

      await domain.registerEventHandler(customHandler);
    });

    it("should resolve", async () => {
      await expect(
        // @ts-ignore
        domain.handleEvent(eventWithData, sagaIdentifier),
      ).resolves.toBeUndefined();
    });

    it("should not save the saga", () => {
      expect(test.save).toBeUndefined();
    });

    it("should try to clear commands from saga", () => {
      expect(clearSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          messagesToDispatch: expect.arrayContaining([commandWithData]),
        }),
      );
    });

    it("publish undispatched commands to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published).toStrictEqual(
        expect.arrayContaining([commandWithData]),
      );
    });

    it("publish SagaAlreadyCreatedError to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "SagaAlreadyCreatedError",
          }),
        ]),
      );
    });
  });

  describe("when handling an event with created [false] and permanent [false] condition", () => {
    let test: any = {};
    let domain: SagaDomain<any>;

    const clearSpy = jest.fn();

    beforeAll(async () => {
      domain = new SagaDomain({
        sagaStore: {
          type: StoreType.CUSTOM,
          custom: {
            load: async (sagaIdentifier) => {
              test.load = { sagaIdentifier };
              return new Saga<any>(
                {
                  id: "2a553a74-0f84-4a7d-b91e-2902666db98c",
                  name: "sagaName",
                  context: "defaultContext",
                  messagesToDispatch: [commandWithData],
                  revision: 1,
                },
                logger,
              );
            },
            save: async (saga, causation, options?) => {
              test.save = { saga, causation, options };
              return saga;
            },
            clearMessagesToDispatch: async (saga) => {
              clearSpy(saga);
              test.clearMessagesToDispatch = { saga };
              return new Saga({ ...saga, messagesToDispatch: [] }, logger);
            },
          },
        },
        messageBus: {},
        logger,
      });

      const customHandler = new SagaEventHandler({
        eventName: eventWithData.name,
        aggregate: aggregateIdentifier,
        saga: sagaIdentifier,
        conditions: {
          created: false,
          permanent: false,
        },
        getSagaId: () => "customEventId",
        handler: async (ctx) => {
          ctx.mergeState({ customEvent: true });
        },
      });

      await domain.registerEventHandler(customHandler);
    });

    it("should reject with transient SagaAlreadyCreatedError", async () => {
      // @ts-ignore
      await expect(domain.handleEvent(eventWithData, sagaIdentifier)).rejects.toThrow(
        SagaAlreadyCreatedError,
      );
    });
  });

  describe("when no event handler has been registered", () => {
    let domain: SagaDomain<any>;

    beforeAll(async () => {
      domain = new SagaDomain({ sagaStore: {}, messageBus: {}, logger });

      await domain.registerEventHandler(sagaHandlerWithDispatch);
      await domain.registerEventHandler(sagaHandlerWithSaveOptions);
    });

    it("should throw HandlerNotRegisteredError", async () => {
      // @ts-ignore
      await expect(domain.handleEvent(eventWithData, sagaIdentifier)).rejects.toThrow(
        HandlerNotRegisteredError,
      );
    });
  });

  describe("when event handler throws an error", () => {
    let domain: SagaDomain<any>;

    const saveSpy = jest.fn();
    const clearSpy = jest.fn();

    beforeAll(async () => {
      domain = new SagaDomain({
        sagaStore: {
          type: StoreType.CUSTOM,
          custom: {
            // @ts-ignore
            save: () => {
              saveSpy();
            },
            // @ts-ignore
            load: () => {
              return new Saga(
                {
                  ...sagaIdentifier,
                  messagesToDispatch: [commandWithCreated],
                },
                logger,
              );
            },
            // @ts-ignore
            clearMessagesToDispatch: () => {
              clearSpy();
            },
          },
        },
        messageBus: {},
        logger,
      });

      const customHandler = new SagaEventHandler({
        eventName: eventWithData.name,
        aggregate: aggregateIdentifier,
        saga: sagaIdentifier,
        getSagaId: (event) => event.aggregate.id,
        handler: async () => {
          throw new Error("HandlerError");
        },
      });

      await domain.registerEventHandler(customHandler);
    });

    it("should throw the error", async () => {
      // @ts-ignore
      await expect(domain.handleEvent(eventWithData, sagaIdentifier)).rejects.toThrow(
        new Error("HandlerError"),
      );
    });

    it("should not save the saga", () => {
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should not publish any undispatched commands on the saga", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published.length).toBe(0);
    });

    it("should not clear any undispatched commands on the saga", () => {
      expect(clearSpy).not.toHaveBeenCalled();
    });
  });

  describe("when event handler throws a permanent domain error", () => {
    let domain: SagaDomain<any>;

    class TestError extends DomainError {
      constructor() {
        super("error", { permanent: true });
      }
    }

    beforeAll(async () => {
      domain = new SagaDomain({
        sagaStore: {},
        messageBus: {},
        logger,
      });

      const customHandler = new SagaEventHandler({
        eventName: eventWithData.name,
        aggregate: aggregateIdentifier,
        saga: sagaIdentifier,
        getSagaId: (event) => event.aggregate.id,
        handler: async () => {
          throw new TestError();
        },
      });

      await domain.registerEventHandler(customHandler);
    });

    it("should resolve", async () => {
      // @ts-ignore
      await expect(domain.handleEvent(eventWithData, sagaIdentifier)).resolves.toBe(
        undefined,
      );
    });

    it("should not save the saga", () => {
      // @ts-ignore
      expect(domain.sagaStore.sagaStore.saveAttempts.length).toBe(0);
    });

    it("should publish a non-mandatory error event to message bus", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published[0]).toMatchSnapshot();
    });
  });

  describe("when event handler throws a non-permanent domain error", () => {
    let domain: SagaDomain<any>;

    class TestError extends DomainError {
      constructor() {
        super("error", { permanent: false });
      }
    }

    const saveSpy = jest.fn();
    const clearSpy = jest.fn();

    beforeAll(async () => {
      domain = new SagaDomain({
        sagaStore: {
          type: StoreType.CUSTOM,
          custom: {
            // @ts-ignore
            save: () => {
              saveSpy();
            },
            // @ts-ignore
            load: () => {
              return new Saga(
                {
                  ...sagaIdentifier,
                  messagesToDispatch: [commandWithCreated],
                },
                logger,
              );
            },
            // @ts-ignore
            clearMessagesToDispatch: () => {
              clearSpy();
            },
          },
        },
        messageBus: {},
        logger,
      });

      const customHandler = new SagaEventHandler({
        eventName: eventWithData.name,
        aggregate: aggregateIdentifier,
        saga: sagaIdentifier,
        getSagaId: (event) => event.aggregate.id,
        handler: async () => {
          throw new TestError();
        },
      });

      await domain.registerEventHandler(customHandler);
    });

    it("should throw the error", async () => {
      // @ts-ignore
      await expect(domain.handleEvent(eventWithData, sagaIdentifier)).rejects.toThrow(
        TestError,
      );
    });

    it("should not save the saga", () => {
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should not publish any undispatched commands on the saga", () => {
      // @ts-ignore
      expect(domain.messageBus.messageBus.published.length).toBe(0);
    });

    it("should not clear any undispatched commands on the saga", () => {
      expect(clearSpy).not.toHaveBeenCalled();
    });
  });
});
