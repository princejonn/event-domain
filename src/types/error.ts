import { LindormErrorOptions } from "@lindorm-io/errors";

export interface DomainErrorOptions extends LindormErrorOptions {
  permanent: boolean;
}
