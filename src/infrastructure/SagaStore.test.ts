import MockDate from "mockdate";
import { Command, DomainEvent } from "../message";
import { Saga } from "../entity";
import { SagaStore } from "./SagaStore";
import { logger } from "../test";
import { SagaCausationError, SagaNotInStoreError, SagaRevisionError } from "../error";

MockDate.set("2022-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "e64b576a-022e-4dd4-8c97-32408012f8d1"),
}));

describe("SagaStore", () => {
  const aggregateIdentifier = {
    id: "2a553a74-0f84-4a7d-b91e-2902666db98c",
    name: "aggregateName",
    context: "aggregateContext",
  };
  const sagaIdentifier = {
    id: "2a553a74-0f84-4a7d-b91e-2902666db98c",
    name: "sagaName",
    context: "sagaContext",
  };

  let sagaStore: SagaStore<any>;
  let event: DomainEvent;

  beforeEach(() => {
    sagaStore = new SagaStore(logger);

    event = new DomainEvent(
      {
        id: "6d35d053-fc89-4ee5-93d6-87c0ceecb8b3",
        name: "eventName",
        aggregate: aggregateIdentifier,
        data: { eventData: true },
      },
      new Command({
        id: "86e9a7ee-7455-4438-9c61-7e41bd0191d5",
        name: "commandName",
        aggregate: aggregateIdentifier,
      }),
    );
  });

  describe("constructor", () => {
    test("should create a saga store", () => {
      expect(new SagaStore(logger)).toStrictEqual(expect.any(SagaStore));
    });

    test("should throw if saga store type is erroneous", () => {
      expect(
        () =>
          new SagaStore({
            // @ts-ignore
            type: "wrong",
          }),
      ).toThrow();
    });
  });

  describe("save", () => {
    test("should save a saga", async () => {
      await expect(
        sagaStore.save(
          new Saga(
            {
              ...sagaIdentifier,
              messagesToDispatch: [],
            },
            logger,
          ),
          event,
        ),
      ).resolves.toMatchSnapshot();
    });

    test("should throw if causation already exists in list", async () => {
      await expect(
        sagaStore.save(
          new Saga(
            {
              ...sagaIdentifier,
              causationList: [event.id],
              messagesToDispatch: [],
            },
            logger,
          ),
          event,
        ),
      ).rejects.toThrow(SagaCausationError);
    });

    test("should throw if revision is wrong", async () => {
      const saga = await sagaStore.save(
        new Saga(
          {
            ...sagaIdentifier,
            causationList: [],
            messagesToDispatch: [],
          },
          logger,
        ),
        event,
      );

      const event2 = new DomainEvent(
        {
          id: "55b4e3ef-3a9c-4f72-9c6a-765ed59bc1b0",
          name: "eventName2",
          aggregate: aggregateIdentifier,
          data: { eventData: true },
        },
        new Command({
          id: "a38165e1-1336-45cf-a428-377231ed9af1",
          name: "commandName2",
          aggregate: aggregateIdentifier,
        }),
      );

      await expect(
        sagaStore.save(
          new Saga(
            {
              ...saga,
              id: saga.id,
              name: saga.name,
              context: saga.context,
              causationList: saga.causationList,
              messagesToDispatch: [],
              destroyed: saga.destroyed,
              revision: 99,
              state: saga.state,
            },
            logger,
          ),
          event2,
        ),
      ).rejects.toThrow(SagaRevisionError);
    });
  });

  describe("load", () => {
    test("should load an existing saga", async () => {
      await sagaStore.save(
        new Saga(
          {
            ...sagaIdentifier,
            messagesToDispatch: [],
            state: { exists: true },
          },
          logger,
        ),
        event,
      );

      await expect(sagaStore.load(sagaIdentifier)).resolves.toMatchSnapshot();
    });

    test("should load a new saga", async () => {
      await expect(sagaStore.load(sagaIdentifier)).resolves.toMatchSnapshot();
    });
  });

  describe("clearMessagesToDispatch", () => {
    test("should successfully clear list of commands", async () => {
      const command2 = new Command({
        id: "cd4bcb6b-ce9d-4cc3-93a0-bc57434c0af6",
        name: "command2",
        aggregate: aggregateIdentifier,
      });

      const saga = await sagaStore.save(
        new Saga(
          {
            ...sagaIdentifier,
            messagesToDispatch: [command2],
          },
          logger,
        ),
        event,
      );

      await expect(sagaStore.clearMessagesToDispatch(saga)).resolves.toMatchSnapshot();
    });

    test("should throw if saga does not exist in store", async () => {
      const saga = new Saga(
        {
          ...sagaIdentifier,
          messagesToDispatch: [],
        },
        logger,
      );

      await expect(sagaStore.clearMessagesToDispatch(saga)).rejects.toThrow(
        SagaNotInStoreError,
      );
    });
  });
});
