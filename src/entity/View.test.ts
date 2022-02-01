import MockDate from "mockdate";
import { Command, DomainEvent } from "../message";
import { IllegalEntityChangeError, ViewDestroyedError } from "../error";
import { View } from "./View";
import { aggregateIdentifier, logger, viewIdentifier } from "../test";

MockDate.set("2022-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "e64b576a-022e-4dd4-8c97-32408012f8d1"),
}));

describe("View", () => {
  const event1 = new DomainEvent(
    {
      id: "15728f08-9693-4c9d-bb36-52614c189c96",
      name: "eventName",
      aggregate: aggregateIdentifier,
      data: { value: "hello world" },
      timestamp: new Date("2022-01-01T08:00:00.000Z"),
    },
    new Command({
      id: "d470745c-81c9-41b9-b6f0-e496ffbb77d2",
      name: "commandName",
      aggregate: aggregateIdentifier,
    }),
  );

  const event2 = new DomainEvent(
    {
      id: "1397365b-ffaa-46f5-b91b-6cfd06e807ed",
      name: "eventName",
      aggregate: aggregateIdentifier,
      data: { value: "foo bar" },
      timestamp: new Date("2022-01-01T08:01:00.000Z"),
    },
    new Command({
      id: "d797feea-a696-46fb-a05b-386a569038b8",
      name: "commandName",
      aggregate: aggregateIdentifier,
    }),
  );

  const event3 = new DomainEvent(
    {
      id: "6076bb19-cde8-4905-975a-8d2dbea5c620",
      name: "eventName",
      aggregate: aggregateIdentifier,
      data: { value: "foo bar" },
      timestamp: new Date("2022-01-01T08:02:00.000Z"),
    },
    new Command({
      id: "96b6139a-091b-46d4-8b4a-b4d985503002",
      name: "commandName",
      aggregate: aggregateIdentifier,
    }),
  );

  describe("when creating a view with non camel case name", () => {
    it("should throw on PascalCase", () => {
      expect(() => new View({ ...viewIdentifier, name: "TestView" }, logger)).toThrow(
        Error,
      );
    });

    it("should throw on snake_case", () => {
      expect(() => new View({ ...viewIdentifier, name: "test_view" }, logger)).toThrow(
        Error,
      );
    });

    it("should throw on kebab-case", () => {
      expect(() => new View({ ...viewIdentifier, name: "test-view" }, logger)).toThrow(
        Error,
      );
    });
  });

  describe("when setting state", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);

      view.setState(event1, "path1.path2", event1.data.value);
    });

    it("should match snapshot", () => {
      expect(view).toMatchSnapshot();
    });

    it("should set state", () => {
      expect(view.state.path1.path2).toStrictEqual("hello world");
    });

    it("should set meta state", () => {
      expect(view.metaState.path1.path2).toStrictEqual({
        r: false,
        t: new Date("2022-01-01T08:00:00.000Z"),
        v: "hello world",
      });
    });
  });

  describe("when overwriting state in order", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);

      view.setState(event1, "path1", event1.data.value);
      view.setState(event2, "path1", event2.data.value);
    });

    it("should match snapshot", () => {
      expect(view).toMatchSnapshot();
    });

    it("should set state to the most recent value", () => {
      expect(view.state.path1).toStrictEqual("foo bar");
    });

    it("should set meta state to the most recent event", () => {
      expect(view.metaState.path1).toStrictEqual({
        r: false,
        t: new Date("2022-01-01T08:01:00.000Z"),
        v: "foo bar",
      });
    });
  });

  describe("when overwriting state out of order", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);

      view.setState(event2, "path1", event2.data.value);
      view.setState(event1, "path1", event1.data.value);
    });

    it("should match snapshot", () => {
      expect(view).toMatchSnapshot();
    });

    it("should set state to the most recent value", () => {
      expect(view.state.path1).toStrictEqual("foo bar");
    });

    it("should set meta state to the most recent event", () => {
      expect(view.metaState.path1).toStrictEqual({
        r: false,
        t: new Date("2022-01-01T08:01:00.000Z"),
        v: "foo bar",
      });
    });
  });

  describe("when adding an item to an array", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);

      view.addField(event1, "path1", event1.data.value);
    });

    it("should match snapshot", () => {
      expect(view).toMatchSnapshot();
    });

    it("should add the value to the array", () => {
      expect(view.state.path1).toStrictEqual(["hello world"]);
    });

    it("should set meta state", () => {
      expect(view.metaState.path1).toStrictEqual([
        {
          r: false,
          t: new Date("2022-01-01T08:00:00.000Z"),
          v: "hello world",
        },
      ]);
    });
  });

  describe("when adding the same item to an array twice", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);

      view.addField(event1, "path1", event1.data.value);
      view.addField(event2, "path1", event1.data.value);
    });

    it("should match snapshot", () => {
      expect(view).toMatchSnapshot();
    });

    it("should add the value to the array once", () => {
      expect(view.state.path1).toStrictEqual(["hello world"]);
    });

    it("should set meta state", () => {
      expect(view.metaState.path1).toStrictEqual([
        {
          r: false,
          t: new Date("2022-01-01T08:01:00.000Z"),
          v: "hello world",
        },
      ]);
    });
  });

  describe("when adding the same object to an array twice", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);

      view.addField(event1, "path1", { hello: "world" });
      view.addField(event2, "path1", { hello: "world" });
    });

    it("should match snapshot", () => {
      expect(view).toMatchSnapshot();
    });

    it("should add the value to the array once", () => {
      expect(view.state.path1).toStrictEqual([{ hello: "world" }]);
    });

    it("should set meta state", () => {
      expect(view.metaState.path1).toStrictEqual([
        {
          r: false,
          t: new Date("2022-01-01T08:01:00.000Z"),
          v: { hello: "world" },
        },
      ]);
    });
  });

  describe("when removing an existing item from an array", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);

      view.addField(event1, "path1", event1.data.value);
      view.removeFieldWhereEqual(event2, "path1", event1.data.value);
    });

    it("should match snapshot", () => {
      expect(view).toMatchSnapshot();
    });

    it("should add the value to the array once", () => {
      expect(view.state.path1).toStrictEqual([]);
    });

    it("should set meta state", () => {
      expect(view.metaState.path1).toStrictEqual([
        {
          r: true,
          t: new Date("2022-01-01T08:01:00.000Z"),
          v: "hello world",
        },
      ]);
    });
  });

  describe("when removing a non-existing item from an array", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);
    });

    it("should throw", () => {
      expect(() =>
        view.removeFieldWhereEqual(event1, "path1", event1.data.value),
      ).toThrow();
    });
  });

  describe("when removing a matching item from an array", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);

      view.addField(event1, "path1", { id: 1, hello: "world" });
      view.removeFieldWhereMatch(event2, "path1", { id: 1 });
    });

    it("should match snapshot", () => {
      expect(view).toMatchSnapshot();
    });

    it("should add the value to the array once", () => {
      expect(view.state.path1).toStrictEqual([]);
    });

    it("should set meta state", () => {
      expect(view.metaState.path1).toStrictEqual([
        {
          r: true,
          t: new Date("2022-01-01T08:01:00.000Z"),
          v: { id: 1, hello: "world" },
        },
      ]);
    });
  });

  describe("when removing a non-matching item from an array", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);
    });

    it("should throw", () => {
      expect(() => view.removeFieldWhereMatch(event1, "path1", { id: 1 })).toThrow();
    });
  });

  describe("when adding a removed item to an array", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);

      view.addField(event1, "path1", "hello world");
      view.removeFieldWhereEqual(event2, "path1", "hello world");
      view.addField(event3, "path1", "hello world");
    });

    it("should match snapshot", () => {
      expect(view).toMatchSnapshot();
    });

    it("should add the value to the array", () => {
      expect(view.state.path1).toStrictEqual(["hello world"]);
    });

    it("should set meta state", () => {
      expect(view.metaState.path1).toStrictEqual([
        {
          r: false,
          t: new Date("2022-01-01T08:02:00.000Z"),
          v: "hello world",
        },
      ]);
    });
  });

  describe("when adding a removed item to an array out of order", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);

      view.addField(event1, "path1", "hello world");
      view.addField(event3, "path1", "hello world");
      view.removeFieldWhereEqual(event2, "path1", "hello world");
    });

    it("should match snapshot", () => {
      expect(view).toMatchSnapshot();
    });

    it("should add the value to the array", () => {
      expect(view.state.path1).toStrictEqual(["hello world"]);
    });

    it("should set meta state", () => {
      expect(view.metaState.path1).toStrictEqual([
        {
          r: false,
          t: new Date("2022-01-01T08:02:00.000Z"),
          v: "hello world",
        },
      ]);
    });
  });

  describe("when destroying a view", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);

      view.destroy();
    });

    it("should match snapshot", () => {
      expect(view).toMatchSnapshot();
    });

    it("should set the view as destroyed", () => {
      expect(view.destroyed).toBe(true);
    });
  });

  describe("when destroying a destroyed view", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);

      view.destroy();
    });

    it("should throw", () => {
      expect(() => view.destroy()).toThrow(ViewDestroyedError);
    });
  });

  describe("when trying to set causationList", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);
    });

    it("should throw", () => {
      expect(() => {
        view.causationList = [];
      }).toThrow(IllegalEntityChangeError);
    });
  });

  describe("when trying to set destroyed", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);
    });

    it("should throw", () => {
      expect(() => {
        view.destroyed = true;
      }).toThrow(IllegalEntityChangeError);
    });
  });

  describe("when trying to set metaState", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);
    });

    it("should throw", () => {
      expect(() => {
        view.metaState = {};
      }).toThrow(IllegalEntityChangeError);
    });
  });

  describe("when trying to set revision", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);
    });

    it("should throw", () => {
      expect(() => {
        view.revision = 2;
      }).toThrow(IllegalEntityChangeError);
    });
  });

  describe("when trying to set state", () => {
    let view: View<any>;

    beforeAll(() => {
      view = new View(viewIdentifier, logger);
    });

    it("should throw", () => {
      expect(() => {
        view.state = {};
      }).toThrow(IllegalEntityChangeError);
    });
  });
});
