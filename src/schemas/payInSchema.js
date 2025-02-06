import Joi from 'joi';

export const ASSIGN_PAYIN_SCHEMA = Joi.object({
    code: Joi.string().label('code').required(),
    api_key: Joi.string().label('api_key').required(),
    merchant_order_id: Joi.string().label('merchant_order_id').required(),
    user_id: Joi.string().label('user_id').required(),
  });