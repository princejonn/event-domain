import { SagaEventHandler } from "../../../src";

export default new SagaEventHandler({
  eventName: "updated",
  aggregate: { name: "greeting" },
  getSagaId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.mergeState(ctx.event.data);
    ctx.logger.info("updated", { data: ctx.event.data });
  },
});
