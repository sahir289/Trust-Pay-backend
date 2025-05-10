import {
  CREATE_BANK_RESPONSE_SCHEMA,
  RESET_BANK_RESPONSE_SCHEMA,
  UPDATE_BANK_RESPONSE_SCHEMA,
  VALIDATE_BANK_RESPONSE_BY_ID,
  // VALIDATE_BANK_RESPONSE_QUERY,
} from '../../schemas/bankResponseSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { getPayInUrlsDao, updatePayInUrlDao } from '../payIn/payInDao.js';
import { getBankResponseDao, updateBotResponseDao } from './bankResponseDao.js';

import {
  getBankResponseService,
  getClaimResponseService,
  getBankMessageServices,
  createBankResponseService,
  updateBankResponseService,
  getBankResponseBySearchService,
} from './bankResponseServices.js';
import { BadRequestError } from '../../utils/appErrors.js';

import { transactionWrapper } from '../../utils/db.js';
import { Role, Status } from '../../constants/index.js';

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

const getClaimResponse = async (req, res) => {
  const { company_id } = req.user;
  const payload = {
    ...req.query,
    company_id,
  };
  const data = await getClaimResponseService(payload);
  return sendSuccess(res, data, 'Bank response retrieved successfully');
};

const getBankResponseBySearch = async (req, res) => {
  const { company_id, role } = req.user;
  const { search, page = 1, limit = 10 } = req.query;
  if (!search) {
    throw new BadRequestError('search is required');
  }
  const data = await getBankResponseBySearchService(
    {
      company_id,
      search,
      page,
      limit,
      ...req.query,
    },
    role,
  );
  console.log('get Bank Response successfully');
  return sendSuccess(res, data, 'BankResponse fetched successfully');
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
  sendSuccess(res, result,"Created Bank Response successfully");
};

const createBankBotResponse = async (req, res) => {
  const x_auth_token = req.headers['x-auth-token'];
  const payload = req.body?.body;
  const { error } = CREATE_BANK_RESPONSE_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }
  const result = await transactionWrapper(createBankResponseService)(
    payload,
    x_auth_token,
    Role.BOT,
    null,
  );
  sendSuccess(res, result, 'Created Bank Bot Response successfully');
};

const updateBankResponse = async (req, res) => {
  const { role } = req.user;
  const { error: idError } = VALIDATE_BANK_RESPONSE_BY_ID.validate(req.params);
  if (idError) {
    throw new ValidationError(idError);
  }
  const { error: bodyError } = UPDATE_BANK_RESPONSE_SCHEMA.validate(req.body);
  if (bodyError) {
    throw new ValidationError(bodyError);
  }
  const payload = req.body;
  const { company_id } = req.user;
  const { id } = req.params;
  const ids = { id, company_id };
  const updateResponse=await updateBankResponseService(ids, payload, role);
  return sendSuccess(
    res,
    { id: updateResponse.id, updated_by: updateResponse.updated_by},
    'BankResponse updated successfully',
  );
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
  const { company_id, user_name } = req.user;
  const { id } = req.params;
  const { amount } = req.body;

  const { error: bodyError } = RESET_BANK_RESPONSE_SCHEMA.validate(req.body);
  if (bodyError) {
    throw new ValidationError(bodyError);
  }

  const botRes = await getBankResponseDao({ id: id, company_id: company_id });
  const previousAmount = botRes?.amount;
  let getallPayinDataByUtr;
  getallPayinDataByUtr = await getPayInUrlsDao({
    user_submitted_utr: botRes.utr,
  });

  if (getallPayinDataByUtr?.length === 0) {
    getallPayinDataByUtr = await getPayInUrlsDao({
      bank_response_id: botRes.id,
    });
  }

  const hasSuccess = getallPayinDataByUtr?.some(
    (item) => item.status === Status.SUCCESS,
  );

  let hasSuccessData = false;
  if (!hasSuccess) {
    const getAllPayinDataByBotResponse = await getPayInUrlsDao({
      bank_response_id: botRes.id,
    });

    hasSuccessData = getAllPayinDataByBotResponse?.some(
      (item) => item.status === Status.SUCCESS,
    );
  }

  if (!hasSuccess && !hasSuccessData) {
    const data = {
      is_used: false,
      updated_by: user_name,
      config: {
        ...(botRes.config || {}),
        ...(amount
          ? {
              previousAmount:
                typeof previousAmount === 'number' && !isNaN(previousAmount)
                  ? previousAmount
                  : botRes.amount,
            }
          : {}),
      },
    };

    if (typeof amount === 'number' && !isNaN(amount)) {
      data.amount = amount;
    }

    await updateBotResponseDao(id, data);

    if (amount) {
      const isEqualUTR = getallPayinDataByUtr?.some(
        (item) => item.user_submitted_utr === botRes.utr,
      );
      const isEqualBotResponse = getallPayinDataByUtr?.some(
        (item) => item.bank_response_id === botRes.id,
      );
      if (isEqualUTR) {
        const updatePayinID = getallPayinDataByUtr?.filter(
          (item) =>
            item.user_submitted_utr === botRes.utr &&
            item.status !== Status.FAILED,
        );
        const updatePayinData = {
          status:
            new Date().getTime() -
              new Date(updatePayinID[0].created_at).getTime() <
            10 * 60 * 1000
              ? Status.ASSIGNED
              : Status.DROPPED,
          user_submitted_utr: null,
          bank_response_id: null,
          updated_by: user_name,
        };
        await updatePayInUrlDao(updatePayinID[0]?.id, updatePayinData);
      } else if (isEqualBotResponse) {
        const updatePayinID = getallPayinDataByUtr?.filter(
          (item) =>
            item.bank_response_id === botRes.id &&
            item.status !== Status.FAILED,
        );
        const updatePayinData = {
          status:
            new Date().getTime() -
              new Date(updatePayinID[0].created_at).getTime() <
            10 * 60 * 1000
              ? Status.ASSIGNED
              : Status.DROPPED,
          user_submitted_utr: null,
          bank_response_id: null,
          updated_by: user_name,
        };
        await updatePayInUrlDao(updatePayinID[0]?.id, updatePayinData);
      }
      return sendSuccess(
        res,
        {},
        `Bot response Reset successful. Previous Amount: ${data.previousAmount}`,
      );
    } else {
      const isEqualUTR = getallPayinDataByUtr?.some(
        (item) => item.user_submitted_utr === botRes.utr,
      );
      const isEqualBotResponse = getallPayinDataByUtr?.some(
        (item) => item.bank_response_id === botRes.id,
      );
      if (isEqualUTR) {
        const updatePayinID = getallPayinDataByUtr?.filter(
          (item) =>
            item.user_submitted_utr === botRes.utr &&
            item.status !== Status.FAILED,
        );
        const updatePayinData = {
          status:
            new Date().getTime() -
              new Date(updatePayinID[0].created_at).getTime() <
            10 * 60 * 1000
              ? Status.ASSIGNED
              : Status.DROPPED,
          user_submitted_utr: null,
          bank_response_id: null,
          updated_by: user_name,
        };
        await updatePayInUrlDao(updatePayinID[0]?.id, updatePayinData);
      } else if (isEqualBotResponse) {
        const updatePayinID = getallPayinDataByUtr?.filter(
          (item) =>
            item.bank_response_id === botRes.id &&
            item.status !== Status.FAILED,
        );
        const updatePayinData = {
          status:
            new Date().getTime() -
              new Date(updatePayinID[0].created_at).getTime() <
            10 * 60 * 1000
              ? Status.ASSIGNED
              : Status.DROPPED,
          user_submitted_utr: null,
          bank_response_id: null,
          updated_by: user_name,
        };
        await updatePayInUrlDao(updatePayinID[0]?.id, updatePayinData);
      }
      return sendSuccess(res, {}, `Bot response Reset successful`);
    }
  } else {
    const successPayinDataID = getallPayinDataByUtr?.filter(
      (item) => item.status === 'SUCCESS',
    );
    return sendError(
      res,
      {},
      `UTR of this entry is already confirmed with ${successPayinDataID[0]?.merchant_order_id} Merchant Order ID, No Changes Applied. Previous Amount: ${botRes.amount}`,
      400,
    );
  }
};

export {
  getBankResponse,
  getClaimResponse,
  createBankResponse,
  createBankBotResponse,
  updateBankResponse,
  getBankMessage,
  getBankResponseBySearch,
  resetBankResponse,
};
