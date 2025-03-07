import Joi from 'joi';

export const PAYOUT_DETAILS_SCHEMA = Joi.object({
  user: Joi.string().label('user').required(),
  merchant_id: Joi.string().label('merchant_id').required(),
  bank_acc_id: Joi.string().label('bank_acc_id').required(),
  amount: Joi.number().label('amount').required(),
  status: Joi.string()
    .valid('PENDING', 'COMPLETED', 'FAILED')
    .label('status')
    .required(),
  currency: Joi.string().length(3).label('currency').required(),
  merchant_order_id: Joi.string().label('merchant_order_id').required(),
  acc_no: Joi.string().length(10).label('acc_no').required(),
  acc_holder_name: Joi.string().label('acc_holder_name').required(),
  ifsc_code: Joi.string().label('ifsc_code').required(),
  bank_name: Joi.string().label('bank_name').required(),
  upi_id: Joi.string().label('upi_id').optional(), // UPI ID could be in email format
  utr_id: Joi.string().label('utr_id').required(),
  is_enable: Joi.boolean().label('is_enable').default(true).optional(), // `is_enable` should be a boolean
  rejected_reason: Joi.string().label('rejected_reason').optional(),
  payout_merchant_commission: Joi.number()
    .label('payout_merchant_commission')
    .required(),
  payout_vendor_commission: Joi.number()
    .label('payout_vendor_commission')
    .required(),
  from_bank_acc_id: Joi.string().label('from_bank_acc_id').required(),
  config: Joi.object({
    notify_url: Joi.string().uri().label('notify_url').required(),
  })
    .label('config')
    .optional(),
});

export const UPDATE_DETAILS_SCHEMA = Joi.object({
  user: Joi.string().label('user').optional(),
  amount: Joi.number().label('amount').optional(),
  status: Joi.string()
    .valid('PENDING', 'COMPLETED', 'FAILED')
    .label('status')
    .optional(),
  currency: Joi.string().length(3).label('currency').optional(),
  acc_no: Joi.string().length(10).label('acc_no').optional(),
  acc_holder_name: Joi.string().label('acc_holder_name').optional(),
  ifsc_code: Joi.string().label('ifsc_code').optional(),
  bank_name: Joi.string().label('bank_name').optional(),
  upi_id: Joi.string().email().label('upi_id').optional(), // UPI ID could be in email format
  utr_id: Joi.string().label('utr_id').optional(),
  is_enable: Joi.boolean().label('is_enable').default(true), // `is_enable` should be a boolean
  rejected_reason: Joi.string().label('rejected_reason').optional(),
  payout_merchant_commission: Joi.number()
    .label('payout_merchant_commission')
    .optional(),
  payout_vendor_commission: Joi.number()
    .label('payout_vendor_commission')
    .optional(),
  from_bank_acc_id: Joi.string().label('from_bank_acc_id').optional(),
  approved_at: Joi.date().iso().label('approved_at').optional(),
  rejected_at: Joi.date().iso().allow(null).label('rejected_at'), // Allow null if rejected_at is null
  config: Joi.object({
    notify_url: Joi.string().uri().label('notify_url').optional(),
  })
    .label('config')
    .optional(),
  updated_by: Joi.string().label('updated_by').optional(),
  is_obsolete: Joi.boolean().label('is_obsolete').optional(),
});

export const VALIDATE_PAYOUT_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});
