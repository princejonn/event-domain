import Joi from "joi";
import { JOI_MESSAGE } from "../constant";

export const VIEW_ADD_FIELD_SCHEMA = Joi.object({
  path: Joi.string().required(),
  value: Joi.any().required(),
  causation: JOI_MESSAGE,
});

export const VIEW_REMOVE_FIELD_WHERE_EQUAL_SCHEMA = Joi.object({
  path: Joi.string().required(),
  value: Joi.any().required(),
  causation: JOI_MESSAGE,
});

export const VIEW_REMOVE_FIELD_WHERE_MATCH_SCHEMA = Joi.object({
  path: Joi.string().required(),
  value: Joi.any().required(),
  causation: JOI_MESSAGE,
});

export const VIEW_SET_STATE_SCHEMA = Joi.object({
  path: Joi.string().required(),
  value: Joi.any().required(),
  causation: JOI_MESSAGE,
});
