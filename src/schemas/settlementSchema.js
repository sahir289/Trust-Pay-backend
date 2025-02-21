import Joi from 'joi';

export const CREATE_SETTLEMENT_SCHEMA = Joi.object({
  id: Joi.string().label('id').optional(),
  user_id: Joi.string().label('user_id').required(),
  status: Joi.string().label('status').required(),
  amount: Joi.number().label('amount').required(),
  method: Joi.string().label('method').required(),
  created_by: Joi.string().label('created_by').required(),
  company_id : Joi.string().label('company_id').required()
});
export const UPDATE_SETTLEMENT_SCHEMA = Joi.object({
    user_id: Joi.string().label('user_id').optional(),
    status: Joi.string().label('status').required(),
    amount: Joi.number().label('amount').optional(),
    method: Joi.string().label('method').optional(),
    created_by: Joi.string().label('created_by').required(),
    company_id: Joi.string().label('company_id').required(),
    config: Joi.object({
        reference_id: Joi.string().label('reference_id').required(), 
    }).label('config').required()
});

export const VALIDATE_SETTLEMENT_BY_ID = Joi.string().guid({ version: ['uuidv4'] }).required().messages({
  'string.guid': 'ID must be a valid UUID',
  'any.required': 'ID is required',
});
