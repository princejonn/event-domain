import { StructureScanner } from "./StructureScanner";

describe("StructureScanner", () => {
  const scanner = new StructureScanner(__dirname, [".ts"]);

  test("should scan directory", () => {
    expect(scanner.scan()).toStrictEqual(
      expect.arrayContaining([
        {
          name: "StructureScanner",
          parents: [],
          path: expect.stringContaining("/src/util/StructureScanner.ts"),
          relative: "StructureScanner.ts",
        },
      ]),
    );
  });
});
