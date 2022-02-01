import Joi from "joi";
import { AggregateCommandHandler } from "../../../../src";

export default new AggregateCommandHandler({
  conditions: { created: false },
  schema: Joi.object(),
  handler: async (ctx) => {
    await ctx.apply("created", ctx.command.data);
  },
});
