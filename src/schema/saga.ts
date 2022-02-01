import Joi from "joi";
import { JOI_MESSAGE } from "../constant";

export const SAGA_DISPATCH_SCHEMA = Joi.object({
  command: JOI_MESSAGE,
  causation: JOI_MESSAGE,
});

export const SAGA_UPDATE_STATE_SCHEMA = Joi.object({
  data: Joi.object().required(),
});
