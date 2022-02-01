import Joi from "joi";

export const JOI_IDENTIFIER = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  context: Joi.string().required(),
});

export const JOI_MESSAGE = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),

  aggregate: JOI_IDENTIFIER.required(),
  causationId: Joi.string().required(),
  correlationId: Joi.string().required(),
  data: Joi.object().required(),
  delay: Joi.number().required(),
  mandatory: Joi.boolean().required(),
  timestamp: Joi.date().required(),
  type: Joi.string().required(),
});
