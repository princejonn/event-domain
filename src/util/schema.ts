import Joi from "joi";

export const validateSchemaSync = (schema: Joi.Schema, data: any): void => {
  const result = schema.validate(data);

  if (result?.error) {
    throw result.error;
  }
};

export const validateSchemaAsync = async (schema: Joi.Schema, data: any): Promise<void> => {
  await schema.validateAsync(data);
};
