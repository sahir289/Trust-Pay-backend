import Joi from 'joi';

export const BANK_ACCOUNT_SCHEMA = Joi.object({
    user_id: Joi.string().uuid().label('user_id').required(),
    upi_id: Joi.string().uuid().label('upi_id').required(),
    upi_params: Joi.string().label('upi_params').optional(),
    nick_name: Joi.string().label('nick_name').optional(),
    acc_holder_name: Joi.alternatives().try(Joi.string(), Joi.number()).label('acc_holder_name').required(),
    ac_name: Joi.string().label('ac_name').required(),
    ifsc: Joi.string().label('ifsc').required(),
    bank_name: Joi.string().label('bank_name').required(),
    is_qr: Joi.boolean().label('is_qr').required(),
    is_bank: Joi.boolean().label('is_bank').required(),
    min_payin: Joi.number().label('min_payin').required(),
    max_payin: Joi.number().label('max_payin').required(),
    is_enabled: Joi.boolean().label('is_enabled').required(),
    payin_count: Joi.number().label('payin_count').required(),
    balance: Joi.number().label('balance').required(),
    today_balance: Joi.number().label('today_balance').required(),
    bank_used_for: Joi.string().label('bank_used_for').required(),
    config: Joi.object().label('config').optional(),
    updated_by: Joi.string().label('updated_by').optional(),
    created_at: Joi.date().iso().label('created_at').required(),
    updated_at: Joi.date().iso().label('updated_at').required(),
    company_id: Joi.string().uuid().label('company_id').required(),
    is_obsolete: Joi.boolean().label('is_obsolete').required()
});

export const VALIDATE_BANK_RESPONSE_BY_ID = Joi.object({
    id: Joi.string().guid({ version: ['uuidv4'] }).required().messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});