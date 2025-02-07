import Joi from 'joi';

export const ASSIGN_PAYIN_SCHEMA = Joi.object({
  code: Joi.string().label('code').required(),
  api_key: Joi.string().label('api_key').required(),
  merchant_order_id: Joi.string().label('merchant_order_id').optional(),
  user_id: Joi.string().label('user_id').required(),
});

export const VALIDATE_PAYIN_SCHEMA = Joi.object({
  payInId: Joi.string().guid({ version: ['uuidv4'] }).label('payInId').required(),
});