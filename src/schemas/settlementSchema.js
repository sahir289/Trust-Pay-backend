import Joi from 'joi';

export const CREATE_SETTLEMENT_SCHEMA = Joi.object({
  id : Joi.string().guid({ version: ['uuidv4'] }).label('id').optional(),
  user_id: Joi.string().guid({ version: ['uuidv4'] }).label('user_id').optional(),
  status: Joi.string().label('status').optional(),
  amount: Joi.number().label('amount').optional(),
  method: Joi.string().label('method').optional(),
  created_by: Joi.string().label('created_by').optional(),
  config: Joi.object({
    reference_id: Joi.string().label('reference_id').optional(),
  }).label('config').optional(),
  company_id: Joi.string().label('company_id').optional()
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
  }).label('config').optional()
});

export const VALIDATE_SETTLEMENT_BY_ID = Joi.object({
  id: Joi.string().guid({ version: ['uuidv4'] }).optional().messages({
    'string.guid': 'ID must be a valid UUID',
    'any.optional': 'ID is optional',
  }),
});


export const VALIDATE_SETTLEMENT_BY_ID_DELETE = 
  Joi.string().guid({ version: ['uuidv4'] }).optional().messages({
    'string.guid': 'ID must be a valid UUID',
    'any.optional': 'ID is optional',

});