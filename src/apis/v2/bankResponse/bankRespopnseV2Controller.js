
import { ValidationError } from '../../../utils/appErrors.js';
import { sendSuccess } from '../../../utils/responseHandlers.js';
import { Role } from '../../../constants/index.js';
import { CREATE_BANK_RESPONSE_V2_SCHEMA } from '../../../schemas/bankResponseSchema.js';
import { publishBankResponse } from '../../../rabbitmq/producer.js';

export const createBankBotV2Response = async (req, res) => {
  
  const company_id = req.vendor?.company_id;
  const payload = req.body;
  const { error } = CREATE_BANK_RESPONSE_V2_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }

  const bankResponseObject = {
    payload,
    company_id,
    role:Role.BOT,
  };
  const result = await publishBankResponse(bankResponseObject);
  // const result = await createBankResponseService(
  //   payload,
  //   company_id,
  //   Role.BOT,
  //   null,
  // );
  // await newTableEntry(tableName.BANK_RESPONSE);
  sendSuccess(res, result, 'Created Bank Bot Response successfully');
};
