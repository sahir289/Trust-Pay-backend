import Joi from 'joi';

export const SUPER_ADMIN_DASHBOARD_SCHEMA = Joi.object({
  startDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'startDate must be in YYYY-MM-DD format',
      'any.required': 'startDate is required',
    }),
  endDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'endDate must be in YYYY-MM-DD format',
      'any.required': 'endDate is required',
    }),
});

export const SUPER_ADMIN_TOP_BANKS_SCHEMA = Joi.object({
  startDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .messages({
      'string.pattern.base': 'startDate must be in YYYY-MM-DD format',
    }),
  endDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .messages({
      'string.pattern.base': 'endDate must be in YYYY-MM-DD format',
    }),
  limit: Joi.number().integer().min(1).max(50).default(5),
  sortBy: Joi.string().valid('volume', 'count').default('volume'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
}).and('startDate', 'endDate');

