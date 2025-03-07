import Joi from 'joi';

export const CREATE_USER_SCHEMA = Joi.object({
  role_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('role_id')
    .optional(),
  designation_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('designation_id')
    .optional(),
  first_name: Joi.string().label('first_name').optional(),
  last_name: Joi.string().label('last_name').optional(),
  email: Joi.string().email().label('email').optional(),
  contact_no: Joi.string()
    .pattern(/^\d{10,15}$/)
    .label('contact_no')
    .optional(), // Allows 10-15 digit numbers
  user_name: Joi.string().label('user_name').optional(),
  password: Joi.string().label('password').optional(), // Enforcing a min length for security
  code: Joi.string().label('code').optional(),
  is_enabled: Joi.boolean().label('is_enabled').optional(),
  config: Joi.object().label('config').optional(),
});

export const VALIDATE_USER_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .optional()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.optional': 'ID is optional',
    }),
});
