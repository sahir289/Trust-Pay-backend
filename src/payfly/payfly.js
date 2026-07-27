import crypto from 'crypto';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { sendNewSuccess } from '../utils/responseHandlers.js';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';
import { BadRequestError } from '../utils/appErrors.js';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';

const PAYFLY_TIMEOUT_MS = 30000;

const getPayflyConfig = (companyPayflyConfig = {}) => {
  const payflyConfig = {
    baseUrl: config.payfly.baseUrl,
    mid: companyPayflyConfig.mid,
    payoutSecret: companyPayflyConfig.payoutSecret,
  };
  if (!payflyConfig?.baseUrl || !payflyConfig?.mid || !payflyConfig?.payoutSecret) {
    throw new BadRequestError('Payfly payout configuration is incomplete');
  }
  return payflyConfig;
};

const createPayflyToken = ({ mid, payoutSecret }) => jwt.sign(
  {
    mid,
    sub: mid,
    jti: crypto.randomUUID(),
    iss: 'user-app',
    aud: 'payout-api',
  },
  payoutSecret,
  { algorithm: 'HS256', expiresIn: '10m' },
);

export const createPayflyHash = (payload, payoutSecret) => {
  const canonicalPayload = Object.entries(payload)
    .filter(([key]) => key !== 'hash')
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('|');

  return crypto
    .createHmac('sha256', payoutSecret)
    .update(canonicalPayload)
    .digest('hex');
};

const buildPayflyMerchantTransactionId = (merchantOrderId, mid) => {
  const reference = String(merchantOrderId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .trim();
  const transactionId = reference.startsWith(mid)
    ? reference
    : `${mid}${reference}`;

  if (transactionId.length <= 50) {
    return transactionId;
  }

  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `${mid}${timestamp}${random}`.slice(0, 50);
};

export const createPayflyPayout = async (
  result,
  payout,
  vendorId,
  bankId,
  payflyCompanyConfig,
) => {
  const payflyConfig = getPayflyConfig(payflyCompanyConfig);
  const merchantTransactionId = buildPayflyMerchantTransactionId(
    payout?.merchant_order_id,
    payflyConfig.mid,
  );
  const beneficiaryMobile = payflyCompanyConfig?.beneficiaryMobile;
  const beneficiaryEmail = payflyCompanyConfig?.beneficiaryEmail;
  const beneficiaryName = payout?.user_bank_details?.account_holder_name;
  const accountNumber = payout?.user_bank_details?.account_no;
  const ifsc = payout?.user_bank_details?.ifsc_code;
  if (!beneficiaryMobile || !beneficiaryEmail || !beneficiaryName || !accountNumber || !ifsc) {
    throw new BadRequestError('Payfly company mobile/email and payout name, account number, and IFSC are required');
  }
  const requestBody = {
    merchant_txnid: merchantTransactionId,
    beneficiary_name: beneficiaryName,
    beneficiary_mobile: String(beneficiaryMobile),
    beneficiary_email: String(beneficiaryEmail),
    account_number: String(accountNumber),
    ifsc: String(ifsc),
    amount: Number(payout?.amount).toFixed(2),
    pay_mode:'IMPS',
    remark:'Payout',
  };
  requestBody.hash = createPayflyHash(requestBody, payflyConfig.payoutSecret);
  try {
    const response = await axios.post(
      `${payflyConfig.baseUrl}/payment/transfer`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${createPayflyToken(payflyConfig)}`,
          'User-MID': payflyConfig.mid,
        },
        timeout: PAYFLY_TIMEOUT_MS,
      },
    );
    const responseData = response.data;
    if (String(responseData?.respCode) !== '0') {
      throw new BadRequestError(responseData?.respMessage || 'Payfly payout request failed');
    }
    result.status = 'PENDING';
    result.bank_acc_id = bankId;
    result.vendor_id = vendorId;
    result.config = {
      ...result.config,
      txnid: merchantTransactionId
    };
    return result;
  } catch (error) {
    logger.error('Payfly payout error:', {
      merchant_order_id: payout?.merchant_order_id,
      error: error.message,
    });
    throw error;
  }
};

export const getPayflyWalletBalance = async (req, res) => {
  try {
    const [company] = await getCompanyByIDDao({ id: req.user.company_id });
    const payflyConfig = getPayflyConfig(company?.config?.PAYFLY);
    const response = await axios.get(
      `${payflyConfig.baseUrl}/payment/balance`,
      {
        headers: {
          Authorization: `Bearer ${createPayflyToken(payflyConfig)}`,
          'User-MID': payflyConfig.mid,
        },
        timeout: PAYFLY_TIMEOUT_MS,
      },
    );
    if (String(response.data?.respCode) !== '0') {
      throw new BadRequestError(
        response.data?.respMessage || 'Payfly balance request failed',
      );
    }
    return sendNewSuccess(
      res,
      response.data?.data || {},
      response.data?.respMessage || 'Payfly wallet balance fetched successfully',
    );
  } catch (error) {
    logger.error('Payfly wallet balance error:', {
      company_id: req.user?.company_id,
      error: error.response?.data || error.message || error,
    });
    throw error;
  }
};