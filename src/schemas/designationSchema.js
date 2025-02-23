import Joi from 'joi';

export const CREATE_DESIGNATION_SCHEMA = Joi.object({
  id: Joi.string().guid({ version: ['uuidv4'] }).label('id').optional(),
  designation: Joi.string().label('designation').required(),
  role_id: Joi.string().guid({ version: ['uuidv4'] }).label('role_id').required(),
  created_by: Joi.string().label('created_by').required(),
  created_at: Joi.date().iso().label('created_at').required(),
  updated_at: Joi.date().iso().label('updated_at').required(),
  company_id: Joi.string().uuid().label('company_id').required()
});
export const UPDATE_DESIGNATION_SCHEMA = Joi.object({
  designation: Joi.string().label('designation').required(),
  role_id: Joi.string().guid({ version: ['uuidv4'] }).label('role_id').optional(),
  created_by: Joi.string().label('created_by').optional(),
  created_at: Joi.date().iso().label('created_at').optional(),
  updated_at: Joi.date().iso().label('updated_at').optional(),
  company_id: Joi.string().uuid().label('company_id').optional()});

export const VALIDATE_DESIGNATION_BY_ID = Joi.object({
    id: Joi.string().guid({ version: ['uuidv4'] }).required().messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});