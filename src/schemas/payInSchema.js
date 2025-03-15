import Joi from 'joi';
import { BankTypes } from '../constants/index.js';

export const ASSIGN_PAYIN_SCHEMA = Joi.object({
  ot: Joi.string().label('ot').optional(),
  amount: Joi.number().positive().label('amount').optional(),
  code: Joi.string().label('code').required(),
  api_key: Joi.string().label('api_key').optional(),
  merchant_order_id: Joi.string().label('merchant_order_id').optional(),
  user_id: Joi.string().label('user_id').required(),
});

export const VALIDATE_PAYIN_SCHEMA = Joi.object({
  merchantOrderId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('merchantOrderId')
    .required(),
});

export const VALIDATE_ASSIGNED_BANT_TO_PAY = Joi.object({
  merchantOrderId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('merchantOrderId')
    .required(),
  amount: Joi.number().positive().label('amount').required(),
  type: Joi.string()
    .valid(...Object.values(BankTypes))
    .label('type')
    .required(),
});

export const VALIDATE_EXPIRE_PAY_IN_URL = Joi.object({
  payInId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('payInId')
    .required(),
});

export const VALIDATE_CHECK_PAY_IN_STATUS = Joi.object({
  payInId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('payInId')
    .required(),
  merchantCode: Joi.string().label('merchantCode').required(),
  merchantOrderId: Joi.string().label('merchantOrderId').required(),
});

export const VALIDATE_PAY_IN_INTENT_GENERATE_ORDER = Joi.object({
  payInId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('payInId')
    .required(),
  amount: Joi.number().positive().label('amount').required(),
  isRazorpay: Joi.boolean().label('isRazorpay').required(),
});
export const VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS = Joi.object({
  payInId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('payInId')
    .required(),
  type: Joi.string().label('type').required(),
});

export const VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS = Joi.object({
  merchantOrderId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('merchantOrderId')
    .required(),
  nick_name: Joi.string().label('nick_name').required(),
});

export const VALIDATE_RESET_DEPOSIT = Joi.object({
  merchant_order_id: Joi.string()
    .label('merchant_order_id')
    .required(),
});


export const VALIDATE_PROCESSE_PAYIN = Joi.object({
  payInId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('payInId')
    .required(),
  userSubmittedUtr: Joi.string().label('userSubmittedUtr').required(),
  code: Joi.string().label('code').min(5).max(5).required(),
  amount: Joi.number().label('amount').min(1).required(),
});

export const VALIDATE_PROCESSE_PAYIN_BY_IMAGE = Joi.object({
  payInId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('payInId')
    .required(),
  amount: Joi.number().label('amount').min(1).required(),
});

export const VALIDATE_DISPUTE_DUPLICATE_TRANSACTION = Joi.object({
  payInId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('payInId')
    .required(),
  merchantOrderId: Joi.string().label('merchantOrderId').optional(),
  confirmed: Joi.number().min(1).label('confirmed').optional(),
  amount: Joi.number().min(1).label('amount').optional(),
});

export const VALIDATE_CHECK_UTR = Joi.object({
  utr: Joi.string().label('utr').required(),
  merchantOrderId: Joi.string().label('merchantOrderId').required(),
});
