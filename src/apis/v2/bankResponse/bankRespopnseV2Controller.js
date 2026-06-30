
import { ValidationError } from '../../../utils/appErrors.js';
import { sendSuccess } from '../../../utils/responseHandlers.js';
import { Role } from '../../../constants/index.js';
import { CREATE_BANK_RESPONSE_V2_SCHEMA } from '../../../schemas/bankResponseSchema.js';
import { publishBankResponse } from '../../../rabbitmq/producer.js';
// import { createBankResponseService } from '../../bankResponse/bankResponseServices.js';

/**
 * POST /v2/payIn/check-payin-status — v2 twin of the v1 status-check endpoint.
 *
 * Reuses the EXACT same `checkPayInStatusService` as v1 (no business-logic
 * duplication); only the response envelope differs (standardized v2 contract via
 * sendV2Success / sendV2Error). The v1 controller/route is left untouched.
 *
 * Validation and expected service errors are returned as v2 envelopes here
 * rather than thrown, so a v2 client always receives the v2 shape.
 */
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
