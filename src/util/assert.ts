import { camelCase } from "lodash";

export const assertCamelCase = (input: string): void => {
  if (camelCase(input) !== input) {
    throw new Error(`${input} is not in camelCase`);
  }
};
