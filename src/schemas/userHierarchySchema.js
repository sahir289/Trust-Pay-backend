import Joi from 'joi';

// Validation Schema for Creating a UserHierarchy
const VALIDATE_USER_HIERARCHY_SCHEMA = Joi.object({
    user_id: Joi.string().guid({ version: ['uuidv4'] }).required().messages({
      'string.guid': 'User ID must be a valid UUID',
      'any.required': 'User ID is required',
    }),
    role_id: Joi.string().guid({ version: ['uuidv4'] }).required().messages({
      'string.guid': 'Role ID must be a valid UUID',
      'any.required': 'Role ID is required',
    }),
    config: Joi.object().default({}).messages({
      'object.base': 'Config must be a valid object',
    }),
    created_by: Joi.string().guid({ version: ['uuidv4'] }).required().messages({
      'string.guid': 'Created By must be a valid UUID',
      'any.required': 'Created By is required',
    }),
    updated_by: Joi.string().guid({ version: ['uuidv4'] }).required().messages({
      'string.guid': 'Updated By must be a valid UUID',
      'any.required': 'Updated By is required',
    }),
    company_id: Joi.string().guid({ version: ['uuidv4'] }).required().messages({
      'string.guid': 'Company ID must be a valid UUID',
      'any.required': 'Company ID is required',
    }),
    created_at: Joi.string().isoDate().required().messages({
      'string.isoDate': 'Created At must be a valid date in ISO 8601 format',
      'any.required': 'Created At is required',
    }),
    updated_at: Joi.string().isoDate().required().messages({
      'string.isoDate': 'Updated At must be a valid date in ISO 8601 format',
      'any.required': 'Updated At is required',
    }),
    is_obsolete: Joi.boolean().default(false),
});

// Validation Schema for Updating a UserHierarchy
const VALIDATE_UPDATE_USER_HIERARCHY_STATUS = Joi.object({
    user_id: Joi.string().guid({ version: ['uuidv4'] }).optional(),
    role_id: Joi.string().guid({ version: ['uuidv4'] }).optional(),
    config: Joi.object().optional(),
    updated_by: Joi.string().guid({ version: ['uuidv4'] }).optional().messages({
      'string.guid': 'Updated By must be a valid UUID',
    }),
    is_obsolete: Joi.boolean().optional(),
    created_at: Joi.string().isoDate().optional().messages({
      'string.isoDate': 'Created At must be a valid date in ISO 8601 format',
    }),
    updated_at: Joi.string().isoDate().optional().messages({
      'string.isoDate': 'Updated At must be a valid date in ISO 8601 format',
    }),
});

// Validation Schema for Deleting a UserHierarchy
const VALIDATE_DELETE_USER_HIERARCHY = Joi.object({
  id: Joi.string().guid({ version: ['uuidv4'] }).label('id').required(),
});

// Validation Schema for Getting a UserHierarchy by ID
const VALIDATE_USER_HIERARCHY_BY_ID = Joi.object({
    id: Joi.string().guid({ version: ['uuidv4'] }).required().messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});

export { 
  VALIDATE_USER_HIERARCHY_BY_ID, 
  VALIDATE_USER_HIERARCHY_SCHEMA, 
  VALIDATE_DELETE_USER_HIERARCHY, 
  VALIDATE_UPDATE_USER_HIERARCHY_STATUS 
};
