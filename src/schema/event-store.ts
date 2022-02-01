import Joi from "joi";
import { JOI_MESSAGE } from "../constant";

export const SAVE_AGGREGATE_SCHEMA = Joi.object({
  aggregate: Joi.object().required(),
  causation: Joi.object().required(),
  events: Joi.array().items(JOI_MESSAGE).required(),
});

export const CAUSATION_EVENTS_SCHEMA = Joi.object({
  causationEvents: Joi.array().items(JOI_MESSAGE).required(),
});
