import Joi from 'joi';

export const CREATE_SETTLEMENT_SCHEMA = Joi.object({
  user_id: Joi.string().guid({ version: ['uuidv4'] }).label('user_id').required(),
  status: Joi.string().label('status').required(),
  amount: Joi.number().label('amount').required(),
  method: Joi.string().label('method').optional(),
  created_by: Joi.string().label('created_by').required(),
  config: Joi.object({
    reference_id: Joi.string().label('reference_id').optional(),
  }).label('config').required(),
  company_id: Joi.string().label('company_id').required()
});
export const UPDATE_SETTLEMENT_SCHEMA = Joi.object({
  user_id: Joi.string().guid({ version: ['uuidv4'] }).label('user_id').optional(),
  status: Joi.string().label('status').optional(),
  amount: Joi.number().label('amount').optional(),
  method: Joi.string().label('method').optional(),
  created_by: Joi.string().label('created_by').optional(),
  company_id: Joi.string().label('company_id').optional(),
  config: Joi.object({
    reference_id: Joi.string().label('reference_id').optional(),
  }).label('config').required()
});

export const VALIDATE_SETTLEMENT_BY_ID = Joi.object({
  id: Joi.string().guid({ version: ['uuidv4'] }).required().messages({
    'string.guid': 'ID must be a valid UUID',
    'any.required': 'ID is required',
  }),
});
