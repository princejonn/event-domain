import Joi from "joi";
import { AggregateCommandHandler } from "../../../../src";

export default new AggregateCommandHandler({
  conditions: { created: true },
  schema: Joi.object(),
  handler: async (ctx) => {
    await ctx.apply("updated", ctx.command.data);
  },
});
