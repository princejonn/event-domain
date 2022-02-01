import Joi from "joi";
import { JOI_IDENTIFIER, JOI_MESSAGE } from "../constant";

export const SAVE_SAGA_SCHEMA = Joi.object({
  saga: JOI_IDENTIFIER.unknown(true).required(),
  causation: JOI_MESSAGE,
  messagesToDispatch: Joi.array().items(JOI_MESSAGE).required(),
});

export const CLEAR_SAGA_MESSAGES_TO_DISPATCH_SCHEMA = Joi.object({
  saga: JOI_IDENTIFIER.unknown(true).required(),
  messagesToDispatch: Joi.array().items(JOI_MESSAGE).required(),
});
