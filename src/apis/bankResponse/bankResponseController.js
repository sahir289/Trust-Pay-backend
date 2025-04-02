import {
  CREATE_BANK_RESPONSE_SCHEMA,

  // VALIDATE_BANK_RESPONSE_QUERY,
} from '../../schemas/bankResponseSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getPayInUrlsDao, updatePayInUrlDao } from '../payIn/payInDao.js';
import { getBankResponseDao, updateBotResponseDao } from './bankResponseDao.js';

import {
  getBankResponseService,
  getBankMessageServices,
  createBankResponseService,
} from './bankResponseServices.js';

import { transactionWrapper } from '../../utils/db.js';

const getBankResponse = async (req, res) => {
  const { role, company_id } = req.user;
  const { page, limit, search } = req.query;
  const payload = {
    ...req.query,
    company_id,
  };
  const data = await getBankResponseService(payload, role, page, limit, search);
  return sendSuccess(res, data, 'Bank response retrieved successfully');
};

const createBankResponse = async (req, res) => {
  const { role, user_name, company_id } = req.user;
  const payload = req.body?.body;
  const { error } = CREATE_BANK_RESPONSE_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }
  const result = await transactionWrapper(createBankResponseService)(
    payload,
    company_id,
    role,
    user_name,
  );
  sendSuccess(res, result);
};

const getBankMessage = async (req, res) => {
  const { company_id } = req.user;
  const { role } = req.user;
  const { bank_id, startDate, endDate, page, limit } = req.query;
  const data = await getBankMessageServices(
    bank_id,
    startDate,
    endDate,
    company_id,
    role,
    page,
    limit,
  );
  return sendSuccess(res, data, 'Get BankResponse successfully');
};

const resetBankResponse = async (req, res) => {
  const { company_id, user_id } = req.user;
  const { id } = req.params;
  const botRes = await getBankResponseDao({ id: id, company_id: company_id });
  let getallPayinDataByUtr;
  getallPayinDataByUtr = await getPayInUrlsDao({
    user_submitted_utr: botRes.utr,
  });

  const hasSuccess = getallPayinDataByUtr?.some(
    (item) => item.status === 'SUCCESS',
  );

  if (!hasSuccess) {
    const data = {
      is_used: false,
      updated_by: user_id,
    };
    await updateBotResponseDao(id, data);

    const isEqualUTR = getallPayinDataByUtr?.some(
      (item) => item.user_submitted_utr === botRes.utr,
    );
    if (isEqualUTR) {
      const updatePayinID = getallPayinDataByUtr?.filter(
        (item) =>
          item.user_submitted_utr === botRes.utr && item.status !== 'FAILED',
      );
      const updatePayinData = {
        status: 'ASSIGNED',
        user_submitted_utr: null,
        updated_by: user_id,
      };
      await updatePayInUrlDao(updatePayinID[0]?.id, updatePayinData);
    }
    return sendSuccess(res, 'Bot response Reset successful');
  } else {
    const successPayinDataID = getallPayinDataByUtr?.filter(
      (item) => item.status === 'SUCCESS',
    );
    return sendSuccess(
      res,
      {},
      `UTR of this entry is already used with ${successPayinDataID[0]?.merchant_order_id} Merchant Order ID, No Changes Applied`,
    );
  }
};

export {
  getBankResponse,
  createBankResponse,
  getBankMessage,
  resetBankResponse,
};
