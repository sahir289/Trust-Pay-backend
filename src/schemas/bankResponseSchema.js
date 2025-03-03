import Joi from 'joi';

export const CREATE_BANK_RESPONSE_SCHEMA = Joi.object({
  body: Joi.string().required().label('body'),
});

export const VALIDATE_BANK_RESPONSE_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});
