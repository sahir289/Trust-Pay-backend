import Joi from 'joi';

export const CREATE_USER_SCHEMA = Joi.object({
    role_id: Joi.string().guid({ version: ['uuidv4'] }).label('role_id').optional(),
    company_id: Joi.string().guid({ version: ['uuidv4'] }).label('company_id').optional(),
    designation_id: Joi.string().guid({ version: ['uuidv4'] }).label('designation_id').optional(),
    first_name: Joi.string().label('first_name').optional(),
    last_name: Joi.string().label('last_name').optional(),
    email: Joi.string().email().label('email').optional(),
    contact_no: Joi.string().pattern(/^\d{10,15}$/).label('contact_no').optional(), // Allows 10-15 digit numbers
    user_name: Joi.string().label('user_name').optional(),
    password: Joi.string().label('password').optional(), // Enforcing a min length for security
    code: Joi.string().label('code').optional(),
    is_enabled: Joi.boolean().label('is_enabled').optional(),
    last_login: Joi.date().iso().allow(null).label('last_login'), // Allow null values
    last_logout: Joi.date().iso().allow(null).label('last_logout'), // Allow null values
    config: Joi.object().label('config').optional(),
    created_by: Joi.string().allow(null).label('created_by'),
    updated_by: Joi.string().allow(null).label('updated_by'),
    created_at: Joi.date().iso().label('created_at').optional(),
    updated_at: Joi.date().iso().label('updated_at').optional()
});



export const VALIDATE_USER_BY_ID = Joi.object({
    id: Joi.string().guid({ version: ['uuidv4'] }).optional().messages({
      'string.guid': 'ID must be a valid UUID',
      'any.optional': 'ID is optional',
    }),
});
