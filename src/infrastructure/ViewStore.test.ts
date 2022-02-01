import MockDate from "mockdate";
import { ViewStore } from "./ViewStore";
import { logger } from "../test";
import { Command, DomainEvent } from "../message";
import { View } from "../entity";
import { ViewCausationError, ViewRevisionError } from "../error";

MockDate.set("2022-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "e64b576a-022e-4dd4-8c97-32408012f8d1"),
}));

describe("ViewStore", () => {
  const aggregateIdentifier = {
    id: "2a553a74-0f84-4a7d-b91e-2902666db98c",
    name: "aggregateName",
    context: "aggregateContext",
  };
  const viewIdentifier = {
    id: "2a553a74-0f84-4a7d-b91e-2902666db98c",
    name: "viewName",
    context: "viewContext",
  };

  let viewStore: ViewStore<any>;
  let event: DomainEvent;

  beforeEach(() => {
    viewStore = new ViewStore(logger);

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
    it("should create a view store", () => {
      expect(new ViewStore(logger)).toStrictEqual(expect.any(ViewStore));
    });

    it("should throw if view store type is erroneous", () => {
      expect(
        () =>
          new ViewStore({
            // @ts-ignore
            type: "wrong",
          }),
      ).toThrow();
    });
  });

  describe("save", () => {
    it("should save a view", async () => {
      await expect(
        viewStore.save(
          new View(
            {
              ...viewIdentifier,
              state: { data: true },
            },
            logger,
          ),
          event,
        ),
      ).resolves.toMatchSnapshot();
    });

    it("should throw if causation already exists in list", async () => {
      await expect(
        viewStore.save(
          new View(
            {
              ...viewIdentifier,
              causationList: [event.id],
            },
            logger,
          ),
          event,
        ),
      ).rejects.toThrow(ViewCausationError);
    });

    it("should throw if revision is wrong", async () => {
      const view = await viewStore.save(
        new View(
          {
            ...viewIdentifier,
            causationList: [],
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
        viewStore.save(
          new View(
            {
              id: view.id,
              name: view.name,
              context: view.context,
              causationList: view.causationList,
              destroyed: view.destroyed,
              metaState: view.metaState,
              revision: 99,
              state: view.state,
            },
            logger,
          ),
          event2,
        ),
      ).rejects.toThrow(ViewRevisionError);
    });
  });

  describe("load", () => {
    it("should load an existing view", async () => {
      await viewStore.save(
        new View(
          {
            ...viewIdentifier,
            state: { exists: true },
          },
          logger,
        ),
        event,
      );

      await expect(viewStore.load(viewIdentifier)).resolves.toMatchSnapshot();
    });

    it("should load a new view", async () => {
      await expect(viewStore.load(viewIdentifier)).resolves.toMatchSnapshot();
    });
  });
});
