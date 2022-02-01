import MockDate from "mockdate";
import { Saga } from "./Saga";
import { IllegalEntityChangeError, MessageTypeError, SagaDestroyedError } from "../error";
import {
  commandWithData,
  commandWithDestroy,
  eventWithData,
  eventWithDestroy,
  logger,
  sagaIdentifier,
} from "../test";

MockDate.set("2020-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "e64b576a-022e-4dd4-8c97-32408012f8d1"),
}));

describe("Saga", () => {
  describe("when creating a saga with camelCase name", () => {
    it("should create saga", () => {
      expect(
        new Saga(
          {
            id: "id",
            name: "camelCasedName",
            context: "default",
          },
          logger,
        ),
      ).toMatchSnapshot();
    });
  });

  describe("when creating a saga with non-camelCase name", () => {
    it("should create saga", () => {
      expect(
        () =>
          new Saga(
            {
              id: "id",
              name: "snake_case_name",
              context: "default",
            },
            logger,
          ),
      ).toThrow(new Error("snake_case_name is not in camelCase"));
    });
  });

  describe("when setting state", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(
        {
          ...sagaIdentifier,
          state: { OBJ: { VAL: "overwrite" } },
        },
        logger,
      );

      saga.setState("OBJ.OBJ.VAL", 12345);
      saga.setState("OBJ.VAL", "value");
      saga.setState("OBJ.OBJ.OBJ", { objectData: true });
    });

    it("should set state and overwrite old values", () => {
      expect(saga.state.OBJ.VAL).toBe("value");
    });

    it("should set state with new values", () => {
      expect(saga.state.OBJ.OBJ.VAL).toBe(12345);
      expect(saga.state.OBJ.OBJ.OBJ.objectData).toBe(true);
    });
  });

  describe("when merging state", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(
        {
          ...sagaIdentifier,
          state: { OBJ: { VAL: "exists", OVER: "write" } },
        },
        logger,
      );

      saga.mergeState({ OBJ: { ADD: "value", OVER: "value", OBJ: { VAL: 12345 } } });
    });

    it("should keep unchanged values", () => {
      expect(saga.state.OBJ.VAL).toBe("exists");
    });

    it("should overwrite new values", () => {
      expect(saga.state.OBJ.OVER).toBe("value");
    });

    it("should add new values", () => {
      expect(saga.state.OBJ.ADD).toBe("value");
      expect(saga.state.OBJ.OBJ.VAL).toBe(12345);
    });
  });

  describe("when destroying a saga", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(sagaIdentifier, logger);

      saga.destroy();
    });

    it("should set saga as destroyed", () => {
      expect(saga.destroyed).toBe(true);
    });
  });

  describe("when dispatching a command", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(sagaIdentifier, logger);

      saga.dispatch(eventWithData, commandWithDestroy);
    });

    it("should add the command in the dispatch list", () => {
      expect(saga.messagesToDispatch).toMatchSnapshot();
    });
  });

  describe("when timing out an event", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(sagaIdentifier, logger);

      saga.timeout(eventWithData, eventWithDestroy.name, eventWithDestroy.data, 999);
    });

    it("should add the command in the dispatch list", () => {
      expect(saga.messagesToDispatch).toMatchSnapshot();
    });
  });

  describe("when trying to dispatch an event", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(sagaIdentifier, logger);
    });

    it("should throw MessageTypeError", () => {
      expect(() => saga.dispatch(eventWithData, eventWithDestroy)).toThrow(
        MessageTypeError,
      );
    });
  });

  describe("when trying to merge state on a destroyed saga", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(
        {
          ...sagaIdentifier,
          destroyed: true,
        },
        logger,
      );
    });

    it("should throw SagaDestroyedError", () => {
      expect(() => saga.mergeState({ data: true })).toThrow(SagaDestroyedError);
    });
  });

  describe("when trying to set state on a destroyed saga", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(
        {
          ...sagaIdentifier,
          destroyed: true,
        },
        logger,
      );
    });

    it("should throw SagaDestroyedError", () => {
      expect(() => saga.setState("path", "value")).toThrow(SagaDestroyedError);
    });
  });

  describe("when trying to destroy a destroyed saga", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(
        {
          ...sagaIdentifier,
          destroyed: true,
        },
        logger,
      );
    });

    it("should throw SagaDestroyedError", () => {
      expect(() => saga.destroy()).toThrow(SagaDestroyedError);
    });
  });

  describe("when trying to dispatch a command on a destroyed saga", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(
        {
          ...sagaIdentifier,
          destroyed: true,
        },
        logger,
      );
    });

    it("should throw SagaDestroyedError", () => {
      expect(() => saga.dispatch(eventWithData, commandWithData)).toThrow(
        SagaDestroyedError,
      );
    });
  });

  describe("when trying to set causationList", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(sagaIdentifier, logger);
    });

    it("should throw", () => {
      expect(() => {
        saga.causationList = [];
      }).toThrow(IllegalEntityChangeError);
    });
  });

  describe("when trying to set destroyed", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(sagaIdentifier, logger);
    });

    it("should throw", () => {
      expect(() => {
        saga.destroyed = true;
      }).toThrow(IllegalEntityChangeError);
    });
  });

  describe("when trying to set messagesToDispatch", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(sagaIdentifier, logger);
    });

    it("should throw", () => {
      expect(() => {
        saga.messagesToDispatch = [];
      }).toThrow(IllegalEntityChangeError);
    });
  });

  describe("when trying to set revision", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(sagaIdentifier, logger);
    });

    it("should throw", () => {
      expect(() => {
        saga.revision = 2;
      }).toThrow(IllegalEntityChangeError);
    });
  });

  describe("when trying to set state", () => {
    let saga: Saga<any>;

    beforeAll(() => {
      saga = new Saga(sagaIdentifier, logger);
    });

    it("should throw", () => {
      expect(() => {
        saga.state = {};
      }).toThrow(IllegalEntityChangeError);
    });
  });
});
