import axios from "axios";
import {sendNewSuccess} from "../utils/responseHandlers.js";
import { logger } from "../utils/logger.js";
import config  from "../config/config.js";
import { BadRequestError, NotFoundError } from "../utils/appErrors.js";
import { getCompanyByIDDao } from "../apis/company/companyDao.js";
import { getBankByIdDao } from "../apis/bankAccounts/bankaccountDao.js";
import { getVendorsDao } from "../apis/vendors/vendorDao.js";
import { Method } from "../constants/index.js";
export const getWalletBalance = async (req, res) => {
  try {
    const company_id = req.user?.company_id;
    const [company] = await getCompanyByIDDao({ id: company_id });
    if(!company) {
        throw new BadRequestError('Company not found for the user');
      }
    const {key} = req.query;
    let secretKey, code;
    if (key === 'pennyPay'){
      secretKey = company?.config?.PENNY_PAY?.secretKey;
      code = company?.config?.PENNY_PAY?.code;
      if (!secretKey || !code) {
        throw new BadRequestError('PennyPay configuration is missing for the company');
      }
    } else if (key === 'trustPay') {
      secretKey = company?.config?.TRUST_PAY?.secretKey;
      code = company?.config?.TRUST_PAY?.code;
      if (!secretKey || !code) {
        throw new BadRequestError('TrustPay configuration is missing for the company');
      }
    } else if (key === 'payBitra') {
      secretKey = company?.config?.PAY_BITRA?.secretKey;
      code = company?.config?.PAY_BITRA?.code;
      if (!secretKey || !code) {
        throw new BadRequestError('PayBitra configuration is missing for the company');
      }
    } else if (key === 'payCric') {
      secretKey = company?.config?.PAY_CRIC?.secretKey;
      code = company?.config?.PAY_CRIC?.code;
      if (!secretKey || !code) {
        throw new BadRequestError('PayCric configuration is missing for the company');
      }
    }
    const providerConfig = config[key];
    if (!providerConfig) throw new Error(`Configuration for key ${key} not found`);
    const url = providerConfig.walletBalanceUrl;
    if (!url) throw new Error(`WALLET_BALANCE_URL is missing for key ${key} in .env`);
    const response = await axios.get(
      url,
      {
        headers: {
          "x-api-key": secretKey,
          code: code,
        },
      }
    );
   const data = response.data.data; 
   const successMsg = response.data.message || "Wallet balance fetched successfully";
    return sendNewSuccess(res, data, successMsg);
  } catch (error) {
    logger.error(
      "Wallet Balance Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};
export const createPennyPayPayout = async (result ,payload ,vendor_id ,bankId, key ,xApiKey, code) => {
  try {
    const providerConfig = config[key];
    const url = providerConfig.payoutUrl;
    if (!url) throw new BadRequestError(`Payout URL is missing in .env for provider ${key}`);
    const requestBody =  {
    user: payload?.user,
    merchant_order_id: payload?.merchant_order_id,
    code: code,
    amount: payload?.amount,
    acc_no: payload?.user_bank_details?.account_no,
    acc_holder_name: payload?.user_bank_details?.account_holder_name,
    ifsc_code: payload?.user_bank_details?.ifsc_code,
    bank_name: payload?.user_bank_details?.bank_name,
  };
  const response = await axios.post(url, requestBody, {
      headers: {
        'x-api-key': xApiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });
    logger.info('PennyPay payout initiated successfully:', {
      merchant_order_id: payload?.merchant_order_id,
      merchantTransactionId: payload?.merchant_order_id,
      data: response.data,
    });
    result.status = 'PENDING';
    result.bank_acc_id = bankId;
    result.vendor_id = vendor_id;
    return result;
  } catch (error) {
  const errorMessage =
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Payout failed';
  logger.error(`${key} payout error:`, {
    message: errorMessage,
    response: error?.response?.data,
  });
  throw new BadRequestError(errorMessage);
}
};

const PENNYPAY_METHOD_META = {
  [Method.PENNYPAY]: {
    configKey: 'PENNY_PAY',
    providerKey: 'pennyPay',
    providerName: 'PennyPay',
  },
  [Method.TRUSTPAY]: {
    configKey: 'TRUST_PAY',
    providerKey: 'trustPay',
    providerName: 'TrustPay',
  },
  [Method.PAYBITRA]: {
    configKey: 'PAY_BITRA',
    providerKey: 'payBitra',
    providerName: 'PayBitra',
  },
  [Method.PAYCRIC]: {
    configKey: 'PAY_CRIC',
    providerKey: 'payCric',
    providerName: 'PayCric',
  },
};
export const processPennyPayFamilyPayout = async (
  method,
  payload,
  ids,
  singleWithdrawData,
  conn,
) => {
  try {
    const meta = PENNYPAY_METHOD_META[method];
    if (!meta) {
      throw new BadRequestError(`Unsupported payout method: ${method}`);
    }
    logger.info(`Processing ${meta.providerName} payout for method: ${method}`);
    const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
    if (!company) {
      throw new NotFoundError('Company not found');
    }
    const providerConfig = company.config?.[meta.configKey];
    const bankId = providerConfig?.defaultBankId;
    if (!bankId) {
      throw new NotFoundError(`Default bank ID not found for ${method}`);
    }
    const bankDataArr = await getBankByIdDao({ id: bankId }, conn);
    if (!bankDataArr[0]) {
      throw new NotFoundError(`Bank not found for ${method} payout`);
    }
    const [vendor] = await getVendorsDao({
      user_id: bankDataArr[0].user_id,
    });
    if (!vendor) {
      throw new NotFoundError(`Vendor not found for ${meta.providerName} payout`);
    }
    const xApiKey = providerConfig?.secretKey;
    const code = providerConfig?.code;
    if (!xApiKey || !code) {
      throw new NotFoundError(
        `${meta.providerName} configuration missing for ${method} payout`,
      );
    }
    logger.info(`Creating ${meta.providerName} payout with bankId: ${bankId}`);
    const updatedPayload = await createPennyPayPayout(
      payload,
      singleWithdrawData,
      vendor.id,
      bankId,
      meta.providerKey,
      xApiKey,
      code,
    );
    return {
      status: updatedPayload?.status,
      vendor_id: updatedPayload?.vendor_id,
      bank_acc_id: updatedPayload?.bank_acc_id,
    };
  } catch (error) {
    logger.error('Error in processPennyPayFamilyPayout:', {
      method,
      payoutId: ids?.id,
      companyId: ids?.company_id,
      error: error.message,
    });
    throw error;
  }
};

