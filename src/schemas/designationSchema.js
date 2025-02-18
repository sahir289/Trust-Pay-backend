import Joi from 'joi';

export const CREATE_DESIGNATION_SCHEMA = Joi.object({
  id: Joi.string().label('id').optional(),
  user_id: Joi.string().label('user_id').optional(),
  status: Joi.string().label('status').required(),
  amount: Joi.number().label('amount').optional(),
  method: Joi.string().label('method').optional(),
  created_by: Joi.string().label('created_by').required(),
  company_id : Joi.string().label('company_id').required()
});
export const UPDATE_DESIGNATION_SCHEMA = Joi.object({
    designation : Joi.string().label('designation').optional(),
});

export const VALIDATE_DESIGNATION_BY_ID = Joi.object({
    id: Joi.string().guid({ version: ['uuidv4'] }).required().messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});