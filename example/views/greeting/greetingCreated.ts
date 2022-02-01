import { ViewEventHandler } from "../../../src";

export default new ViewEventHandler({
  eventName: "created",
  aggregate: { name: "greeting" },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.setState("path1.path2", ctx.event.data);
  },
});
