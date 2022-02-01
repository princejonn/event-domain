import Joi from "joi";
import { JOI_MESSAGE } from "../constant";

export const PUBLISH_SCHEMA = Joi.object({
  messages: Joi.array().items(JOI_MESSAGE),
});

export const SUBSCRIBE_SCHEMA = Joi.object({
  subscription: Joi.object({
    callback: Joi.function().required(),
    sub: Joi.object({
      name: Joi.string().required(),
      aggregate: Joi.object({
        name: Joi.string().required(),
        context: Joi.string().required(),
      }),
      handler: Joi.function(),
    }).required(),
    topic: Joi.object({
      name: Joi.string().required(),
      aggregate: Joi.object({
        name: Joi.string().required(),
        context: Joi.string().required(),
      }),
      handler: Joi.function(),
    }).required(),
  }).required(),
});
