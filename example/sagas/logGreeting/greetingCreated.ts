import { Command, SagaEventHandler } from "../../../src";

export default new SagaEventHandler({
  eventName: "created",
  aggregate: { name: "greeting" },
  getSagaId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.mergeState(ctx.event.data);
    ctx.logger.info("created", { data: ctx.event.data });
    ctx.dispatch(
      new Command({
        name: "update",
        aggregate: ctx.event.aggregate,
        data: { foo: { bar: "baz" } },
      }),
    );
  },
});
