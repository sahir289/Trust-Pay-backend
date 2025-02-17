import Joi from 'joi';

export const ASSIGN_PAYIN_SCHEMA = Joi.object({
  ot: Joi.string().label('ot').optional(),
  amount: Joi.number().positive().label('amount').optional(),
  code: Joi.string().label('code').required(),
  api_key: Joi.string().label('api_key').optional(),
  merchant_order_id: Joi.string().label('merchant_order_id').optional(),
  user_id: Joi.string().label('user_id').required(),
});

export const VALIDATE_PAYIN_SCHEMA = Joi.object({
  payInId: Joi.string().guid({ version: ['uuidv4'] }).label('payInId').required(),
});

export const VALIDATE_ASSIGNED_BANT_TO_PAY = Joi.object({
  payInId: Joi.string().guid({ version: ['uuidv4'] }).label('payInId').required(),
  amount: Joi.number().positive().label('amount').required()
})

export const VALIDATE_EXPIRE_PAY_IN_URL = Joi.object({
  payInId: Joi.string().guid({ version: ['uuidv4'] }).label('payInId').required(),
});

export const VALIDATE_CHECK_PAY_IN_STATUS = Joi.object({
  payInId: Joi.string().guid({ version: ['uuidv4'] }).label('payInId').required(),
  merchantCode: Joi.string().label('merchantCode').required(),
  merchantOrderId: Joi.string().label('merchantOrderId').required(),
});

export const VALIDATE_PAY_IN_INTENT_GENERATE_ORDER = Joi.object({
  payInId: Joi.string().guid({ version: ['uuidv4'] }).label('payInId').required(),
  amount: Joi.number().positive().label('amount').required(),
  isRazorpay: Joi.boolean().label('isRazorpay').required(),
});
export const VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS = Joi.object({
  payInId: Joi.string().guid({ version: ['uuidv4'] }).label('payInId').required(),
  type: Joi.string().label('type').required(),
});

export const VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS = Joi.object({
  id: Joi.string().guid({ version: ['uuidv4'] }).label('id').required(),
  nick_name: Joi.string().label('nick_name').required()
});

export const VALIDATE_RESET_DEPOSIT = Joi.object({
  merchantId: Joi.string().guid({ version: ['uuidv4'] }).label('merchantId').required(),
});