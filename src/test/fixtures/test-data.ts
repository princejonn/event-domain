import { Command, DomainEvent } from "../../message";
import { AggregateCommandHandler, AggregateEventHandler, SagaEventHandler } from "../../handler";
import * as Joi from "joi";

export const aggregateIdentifier = {
  id: "2a553a74-0f84-4a7d-b91e-2902666db98c",
  name: "aggregateName",
  context: "defaultContext",
};
export const sagaIdentifier = {
  id: "2a553a74-0f84-4a7d-b91e-2902666db98c",
  name: "sagaName",
  context: "defaultContext",
};
export const viewIdentifier = {
  id: "2a553a74-0f84-4a7d-b91e-2902666db98c",
  name: "viewName",
  context: "viewContext",
};

export const commandWithData = new Command({
  id: "6c2e5bbd-6643-469d-92ba-f6a140d42cb4",
  name: "commandWithData",
  data: { name: "hello" },
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});
export const commandWithDestroy = new Command({
  id: "fc2bd748-91e3-46ce-b5e5-6cdd2184122f",
  name: "commandWithDestroy",
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});
export const commandWithDestroyNext = new Command({
  id: "b9a4fe17-d276-4ee6-bb9b-63fdc28b8aa3",
  name: "commandWithDestroyNext",
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});
export const commandWithCreated = new Command({
  id: "64081b90-251f-4c56-9bb4-7feee4fa7aeb",
  name: "commandWithCreated",
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});
export const commandWithNotCreated = new Command({
  id: "56a85721-d3fa-4156-a471-f3e1c3bbf5d2",
  name: "commandWithNotCreated",
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});
export const commandWithDispatch = new Command({
  id: "c0e6e07a-17b6-4aa4-967b-0db419afa3ff",
  name: "commandWithDispatch",
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});
export const commandWithTimeout = new Command({
  id: "9481d02c-9e0d-4535-99c9-2160ba49ee5e",
  name: "commandWithTimeout",
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});
export const commandWithSaveOptions = new Command({
  id: "6feae89d-383e-4243-882a-e9f0f4e243f9",
  name: "commandWithSaveOptions",
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});

export const eventWithData = new DomainEvent({
  name: "eventWithData",
  data: commandWithData.data,
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});
export const eventWithDestroy = new DomainEvent({
  name: "eventWithDestroy",
  data: commandWithDestroy.data,
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});
export const eventWithDestroyNext = new DomainEvent({
  name: "eventWithDestroyNext",
  data: commandWithDestroyNext.data,
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});
export const eventWithCreated = new DomainEvent({
  name: "eventWithCreated",
  data: commandWithCreated.data,
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});
export const eventWithNotCreated = new DomainEvent({
  name: "eventWithNotCreated",
  data: commandWithNotCreated.data,
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});
export const eventWithDispatch = new DomainEvent({
  name: "eventWithDispatch",
  data: commandWithDispatch.data,
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});
export const eventWithTimeout = new DomainEvent({
  name: "eventWithTimeout",
  data: commandWithTimeout.data,
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});
export const eventWithSaveOptions = new DomainEvent({
  name: "eventWithSaveOptions",
  data: commandWithSaveOptions.data,
  aggregate: aggregateIdentifier,
  timestamp: new Date("2020-01-01T12:00:00.000Z"),
});

export const commandHandlerWithData = new AggregateCommandHandler({
  commandName: commandWithData.name,
  aggregate: aggregateIdentifier,
  schema: Joi.object(),
  handler: async (ctx) => {
    await ctx.apply(eventWithData.name, ctx.command.data);
  },
});
export const commandHandlerWithDestroy = new AggregateCommandHandler({
  commandName: commandWithDestroy.name,
  aggregate: aggregateIdentifier,
  schema: Joi.object({}),
  handler: async (ctx) => {
    await ctx.apply(eventWithDestroy.name, ctx.command.data);
  },
});
export const commandHandlerWithDestroyNext = new AggregateCommandHandler({
  commandName: commandWithDestroyNext.name,
  aggregate: aggregateIdentifier,
  schema: Joi.object({}),
  handler: async (ctx) => {
    await ctx.apply(eventWithDestroyNext.name, ctx.command.data);
  },
});
export const commandHandlerWithCreated = new AggregateCommandHandler({
  commandName: commandWithCreated.name,
  aggregate: aggregateIdentifier,
  conditions: { created: true },
  schema: Joi.object({}),
  handler: async (ctx) => {
    await ctx.apply(eventWithCreated.name, ctx.command.data);
  },
});
export const commandHandlerWithNotCreated = new AggregateCommandHandler({
  commandName: commandWithNotCreated.name,
  aggregate: aggregateIdentifier,
  conditions: { created: false },
  schema: Joi.object({}),
  handler: async (ctx) => {
    await ctx.apply(eventWithNotCreated.name, ctx.command.data);
  },
});

export const eventHandlerWithData = new AggregateEventHandler({
  eventName: eventWithData.name,
  aggregate: aggregateIdentifier,
  handler: async (ctx) => {
    ctx.mergeState(ctx.event.data);
    ctx.setState("OBJ.STR", "value");
    ctx.setState("OBJ.OBJ.NUM", 123456);
  },
});
export const eventHandlerWithDestroy = new AggregateEventHandler({
  eventName: eventWithDestroy.name,
  aggregate: aggregateIdentifier,
  handler: async (ctx) => {
    ctx.destroy();
  },
});
export const eventHandlerWithDestroyNext = new AggregateEventHandler({
  eventName: eventWithDestroyNext.name,
  aggregate: aggregateIdentifier,
  handler: async (ctx) => {
    ctx.destroyNext();
  },
});
export const eventHandlerWithCreated = new AggregateEventHandler({
  eventName: eventWithCreated.name,
  aggregate: aggregateIdentifier,
  handler: async (ctx) => {
    ctx.mergeState(ctx.event.data);
  },
});
export const eventHandlerWithNotCreated = new AggregateEventHandler({
  eventName: eventWithNotCreated.name,
  aggregate: aggregateIdentifier,
  handler: async (ctx) => {
    ctx.mergeState(ctx.event.data);
  },
});

export const sagaHandlerWithData = new SagaEventHandler({
  eventName: eventWithData.name,
  aggregate: aggregateIdentifier,
  saga: sagaIdentifier,
  getSagaId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.mergeState(ctx.event.data);
    ctx.setState("OBJ.STR", "value");
    ctx.setState("OBJ.OBJ.NUM", 123456);
  },
});
export const sagaHandlerWithDispatch = new SagaEventHandler({
  eventName: eventWithDispatch.name,
  aggregate: aggregateIdentifier,
  saga: sagaIdentifier,
  getSagaId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.dispatch(
      new Command({
        name: "commandDispatchFromHandler",
        aggregate: aggregateIdentifier,
      }),
    );
  },
});
export const sagaHandlerWithTimeout = new SagaEventHandler({
  eventName: eventWithTimeout.name,
  aggregate: aggregateIdentifier,
  saga: sagaIdentifier,
  getSagaId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.timeout("eventWasTimedOut", { timeout: true }, 999);
  },
});
export const sagaHandlerWithMultipleContext = new SagaEventHandler({
  eventName: eventWithTimeout.name,
  aggregate: {
    name: aggregateIdentifier.name,
    context: [aggregateIdentifier.context, "anotherContext"],
  },
  saga: sagaIdentifier,
  getSagaId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.mergeState(ctx.event.data);
  },
});
export const sagaHandlerWithSaveOptions = new SagaEventHandler({
  eventName: eventWithSaveOptions.name,
  aggregate: aggregateIdentifier,
  saga: sagaIdentifier,
  saveOptions: {
    causationsCap: 100,
  },
  getSagaId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.mergeState(ctx.event.data);
  },
});
