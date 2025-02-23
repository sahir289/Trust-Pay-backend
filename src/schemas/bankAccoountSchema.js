import Joi from 'joi';

export const BANK_ACCOUNT_SCHEMA = Joi.object({
  user_id: Joi.string().guid({ version: ['uuidv4'] }).label('user_id').required(),
  upi_id: Joi.string().label('upi_id').required(),
  upi_params: Joi.string().label('upi_params').optional(),
  nick_name: Joi.string().label('nick_name').optional(),
  ac_name: Joi.string().label('ac_name').required(),
  ifsc: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).label('ifsc').required(), 
  bank_name: Joi.string().label('bank_name').required(),
  is_qr: Joi.boolean().label('is_qr').required(),
  is_bank: Joi.boolean().label('is_bank').required(),
  min_payin: Joi.number().min(1).label('min_payin').required(),
  max_payin: Joi.number().min(1).label('max_payin').required(),
  is_enabled: Joi.boolean().label('is_enabled').required(),
  payin_count: Joi.number().integer().min(0).label('payin_count').required(),
  balance: Joi.number().label('balance').required(),
  today_balance: Joi.number().label('today_balance').required(),
  bank_used_for: Joi.string().valid('payIn', 'payOut').label('bank_used_for').required(),
  config: Joi.object().label('config').optional(),
  updated_by: Joi.string().label('updated_by').optional(),
  created_at: Joi.date().iso().label('created_at').required(),
  updated_at: Joi.date().iso().label('updated_at').required(),
  company_id: Joi.string().label('company_id').required(),

});

export const UPDATE_BANK_ACCOUNT_SCHEMA = Joi.object({
  upi_id: Joi.string().pattern(/^[\w.-]+@[\w.-]+$/).label('upi_id').optional(), // Validates UPI ID format
    upi_params: Joi.string().label('upi_params').optional(),
    ac_name: Joi.string().label('ac_name').optional(),
    ifsc: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).label('ifsc').optional(), // IFSC code validation
    bank_name: Joi.string().label('bank_name').optional(),
    is_qr: Joi.boolean().label('is_qr').optional(),
    is_bank: Joi.boolean().label('is_bank').optional(),
    min_payin: Joi.number().min(1).label('min_payin').optional(),
    max_payin: Joi.number().min(1).label('max_payin').optional(),
    is_enabled: Joi.boolean().label('is_enabled').optional(),
    payin_count: Joi.number().integer().min(0).label('payin_count').optional(),
    balance: Joi.number().label('balance').optional(),
    today_balance: Joi.number().label('today_balance').optional(), // Added today_balance
    bank_used_for: Joi.string().valid('payIn', 'payOut').label('bank_used_for').optional(), // Enum validation

})



export const VALIDATE_BANK_RESPONSE_BY_ID = Joi.object({
    id: Joi.string().guid({ version: ['uuidv4'] }).required().messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});