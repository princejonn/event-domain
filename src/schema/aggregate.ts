import Joi from "joi";

export const getApplyEventSchema = ({
  id,
  name,
  context,
}: {
  id: string;
  name: string;
  context: string;
}): Joi.Schema =>
  Joi.object({
    name: Joi.string().required(),
    aggregate: Joi.object({
      id: Joi.string().valid(id).required(),
      name: Joi.string().valid(name).required(),
      context: Joi.string().valid(context).required(),
    }).required(),
    data: Joi.object().required(),
    causationId: Joi.string().required(),
  });

export const AGGREGATE_MERGE_STATE_SCHEMA = Joi.object({
  data: Joi.object().required(),
});
