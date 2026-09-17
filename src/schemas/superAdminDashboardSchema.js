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
