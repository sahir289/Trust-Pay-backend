import Joi from 'joi';

export const CREATE_USER_SCHEMA = Joi.object({
    role_id: Joi.string().uuid().label('role_id').required(),
    company_id: Joi.string().uuid().label('company_id').required(),
    designation_id: Joi.string().label('designation_id').required(),
    first_name: Joi.string().label('first_name').required(),
    last_name: Joi.string().label('last_name').required(),
    email: Joi.string().email().label('email').required(),
    contact_no: Joi.string().pattern(/^\d{10,15}$/).label('contact_no').required(), // Allows 10-15 digit numbers
    user_name: Joi.string().label('user_name').required(),
    password: Joi.string().min(6).label('password').required(), // Enforcing a min length for security
    code: Joi.string().label('code').required(),
    is_enabled: Joi.boolean().label('is_enabled').required(),
    last_login: Joi.date().iso().allow(null).label('last_login'), // Allow null values
    last_logout: Joi.date().iso().allow(null).label('last_logout'), // Allow null values
    config: Joi.object().label('config').optional(),
    created_by: Joi.string().allow(null).label('created_by'),
    updated_by: Joi.string().allow(null).label('updated_by'),
    created_at: Joi.date().iso().label('created_at').required(),
    updated_at: Joi.date().iso().label('updated_at').required()
});



export const VALIDATE_USER_BY_ID = Joi.object({
    id: Joi.string().guid({ version: ['uuidv4'] }).required().messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});