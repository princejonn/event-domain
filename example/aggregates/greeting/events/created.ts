import { AggregateEventHandler } from "../../../../src";

export default new AggregateEventHandler({
  handler: async (ctx) => {
    ctx.mergeState(ctx.event.data);
  },
});
