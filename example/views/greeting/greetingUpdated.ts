import { ViewEventHandler } from "../../../src";

export default new ViewEventHandler({
  eventName: "updated",
  aggregate: { name: "greeting" },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.setState("path3.path4", ctx.event.data);
  },
});
