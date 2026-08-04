import Joi from 'joi';

// Validation Schema for Creating a Calculation
const VALIDATE_CALCULATION_SCHEMA = Joi.object({
  role_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('role_id')
    .required(),
  user_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('user_id')
    .required(),
  total_payin_count: Joi.number().integer().min(0).default(0),
  total_payin_amount: Joi.number().min(0).default(0),
  total_payin_commission: Joi.number().min(0).default(0),
  total_payout_count: Joi.number().integer().min(0).default(0),
  total_payout_amount: Joi.number().min(0).default(0),
  total_payout_commission: Joi.number().min(0).default(0),
  total_settlement_count: Joi.number().integer().min(0).default(0),
  total_settlement_amount: Joi.number().min(0).default(0),
  total_chargeback_count: Joi.number().integer().min(0).default(0),
  total_chargeback_amount: Joi.number().min(0).default(0),
  current_balance: Joi.number().min(0).default(0),
  net_balance: Joi.number().min(0).default(0),
  config: Joi.object().optional().default({}),
});

const VALIDATE_UPDATE_USER_CALCULATION_SCHEMA = Joi.object({
  role: Joi.string()
    .valid('Merchant', 'Vendor')
    .label('role')
    .required(),
  runMode: Joi.string()
    .valid('PREVIEW', 'UPDATE')
    .label('runMode')
    .required(),
  fromDate: Joi.date().label('fromDate').required(),
  toDate: Joi.date().label('toDate').required()
});

// Validation Schema for Updating a Calculation
const VALIDATE_UPDATE_CALCULATION_STATUS = Joi.object({
  is_obsolete: Joi.boolean().optional(),
  total_payin_count: Joi.number().integer().min(0).optional(),
  total_payin_amount: Joi.number().min(0).optional(),
  total_payin_commission: Joi.number().min(0).optional(),
  total_payout_count: Joi.number().integer().min(0).optional(),
  total_payout_amount: Joi.number().min(0).optional(),
  total_payout_commission: Joi.number().min(0).optional(),
  total_settlement_count: Joi.number().integer().min(0).optional(),
  total_settlement_amount: Joi.number().min(0).optional(),
  total_chargeback_count: Joi.number().integer().min(0).optional(),
  total_chargeback_amount: Joi.number().min(0).optional(),
  current_balance: Joi.number().min(0).optional(),
  net_balance: Joi.number().min(0).optional(),
  config: Joi.object().optional(),
});

// Validation Schema for Deleting a Calculation
const VALIDATE_DELETE_CALCULATION = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('id')
    .required(),
});

// Validation Schema for Getting a Calculation by User ID
const VALIDATE_CALCULATION_BY_USER_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});

// Validation Schema for Updating Multiple Calculations
const VALIDATE_UPDATE_CALCULATIONS_SCHEMA = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Date must be in YYYY-MM-DD format',
    }),
  user_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .optional()
    .messages({
      'string.guid': 'User ID must be a valid UUID',
    }),
  startDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Start date must be in YYYY-MM-DD format',
    }),
  endDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .messages({
      'string.pattern.base': 'End date must be in YYYY-MM-DD format',
    }),
  company_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .optional()
    .messages({
      'string.guid': 'Company ID must be a valid UUID',
    }),
});

export {
  VALIDATE_CALCULATION_BY_USER_ID,
  VALIDATE_CALCULATION_SCHEMA,
  VALIDATE_DELETE_CALCULATION,
  VALIDATE_UPDATE_CALCULATION_STATUS,
  VALIDATE_UPDATE_USER_CALCULATION_SCHEMA,
  VALIDATE_UPDATE_CALCULATIONS_SCHEMA,
};
