import Joi from 'joi';

export const PAYOUT_DETAILS_SCHEMA = Joi.object({
    user: Joi.string().label('user').required(),
    merchant_id: Joi.string().label('merchant_id').required(),
    bank_acc_id: Joi.string().label('bank_acc_id').required(),
    amount: Joi.number().label('amount').required(),
    status: Joi.string().valid('PENDING', 'COMPLETED', 'FAILED').label('status').required(),
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
    payout_merchant_commission: Joi.number().label('payout_merchant_commission').required(),
    payout_vendor_commission: Joi.number().label('payout_vendor_commission').required(),
    from_bank_acc_id: Joi.string().label('from_bank_acc_id').required(),
    approved_at: Joi.date().iso().label('approved_at').required(),
    rejected_at: Joi.date().iso().allow(null).label('rejected_at'), // Allow null if rejected_at is null
    config: Joi.object({
        notify_url: Joi.string().uri().label('notify_url').required()
    }).label('config').optional(),
    created_by: Joi.string().label('created_by').required(),
    updated_by: Joi.string().label('updated_by').required(),
    company_id: Joi.string().label('company_id').required(),
    user_id: Joi.string().label('company_id').required(),
    is_obsolete: Joi.boolean().label('is_obsolete').required().default(false)
});

export const UPDATE_DETAILS_SCHEMA = Joi.object({
    user: Joi.string().label('user').required(),
    merchant_id: Joi.string().label('merchant_id').required(),
    bank_acc_id: Joi.string().label('bank_acc_id').required(),
    amount: Joi.number().label('amount').required(),
    status: Joi.string().valid('PENDING', 'COMPLETED', 'FAILED').label('status').required(),
    currency: Joi.string().length(3).label('currency').required(),
    merchant_order_id: Joi.string().label('merchant_order_id').required(),
    acc_no: Joi.string().length(10).label('acc_no').required(),
    acc_holder_name: Joi.string().label('acc_holder_name').required(),
    ifsc_code: Joi.string().label('ifsc_code').required(),
    bank_name: Joi.string().label('bank_name').required(),
    upi_id: Joi.string().email().label('upi_id').optional(), // UPI ID could be in email format
    utr_id: Joi.string().label('utr_id').required(),
    is_enable: Joi.boolean().label('is_enable').default(true), // `is_enable` should be a boolean
    rejected_reason: Joi.string().label('rejected_reason').optional(),
    payout_merchant_commission: Joi.number().label('payout_merchant_commission').required(),
    payout_vendor_commission: Joi.number().label('payout_vendor_commission').required(),
    from_bank_acc_id: Joi.string().label('from_bank_acc_id').required(),
    approved_at: Joi.date().iso().label('approved_at').required(),
    rejected_at: Joi.date().iso().allow(null).label('rejected_at'), // Allow null if rejected_at is null
    config: Joi.object({
        notify_url: Joi.string().uri().label('notify_url').required()
    }).label('config').optional(),
    created_by: Joi.string().label('created_by').required(),
    updated_by: Joi.string().label('updated_by').required(),
    company_id: Joi.string().label('company_id').required(),
    is_obsolete: Joi.boolean().label('is_obsolete').required()
});

export const VALIDATE_PAYOUT_BY_ID = Joi.object({
    id: Joi.string().guid({ version: ['uuidv4'] }).required().messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});