import Joi from 'joi';

export const BENEFICIARY_ACCOUNT_SCHEMA = Joi.object({
  user_id: 
    Joi.array().items(Joi.string().guid({ version: ['uuidv4'] }))
  .label('user_id')
  .optional(),
  upi_id: Joi.string().label('upi_id').optional(),
  type: Joi.string().label('type').optional(),
  acc_holder_name: Joi.string().label('acc_holder_name').required(),
  acc_no: Joi.string().label('acc_no').required(),
  ifsc: Joi.string().label('ifsc').required(),
  bank_name: Joi.string().label('bank_name').required(),
  config: Joi.object().label('config').optional(),
});

export const UPDATE_BENEFICIARY_ACCOUNT_SCHEMA = Joi.object({
  config_uniquecode: Joi.string().label('config_uniquecode').optional(),
  upi_id: Joi.string().label('upi_id').optional(),
  acc_holder_name: Joi.string().label('acc_holder_name').optional(),
  acc_no: Joi.number().label('acc_no').optional(),
  ifsc: Joi.string().label('ifsc').optional(),
  bank_name: Joi.string().label('bank_name').optional(),
  config: Joi.object().label('config').optional(),
});

export const VALIDATE_BENEFICIARY_ACCOUNT_BY_ID = Joi.string()
  .guid({ version: ['uuidv4'] })
  .optional()
  .messages({
    'string.guid': 'ID must be a valid UUID',
    'any.optional': 'ID is optional',
  });
