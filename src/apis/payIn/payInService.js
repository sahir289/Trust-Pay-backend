import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import { v4 as uuidv4 } from 'uuid';
// import querystring from 'querystring';
import config from '../../config/config.js';
// import { razorpay } from '../webhooks/razorPay.js';
import { getPayoutsNotifyDao } from '../payOut/payOutDao.js';
import { checkLockEdit } from '../../utils/advisoryLock.js';
import {
  BankTypes,
  Currency,
  Role,
  Status,
  Type,
} from '../../constants/index.js';
import { calculateCommission, calculateDuration } from '../../helpers/index.js';
import {
  merchantPayinCallback,
  merchantPayoutCallback,
} from '../../callBacksAndWebHook/merchantCallBacks.js';
import {
  generatePayInUrlDao,
  updatePayInUrlDao,
  getPayInForCheckStatusDao,
  getPayInForDuplicate,
  getPayinsForServiccDao,
  // getPayInUrlDao,
  // getPayInUrlsDao,
  getPayinsWithHistoryDao,
  // getAllPayInsDao,
  getPayInPendingDao,
  getPayinsSumAndCountByStatusDao,
  getPayInForUpdateServiceDao,
  getPayInForDisputeServiceDao,
  getPayInForTelegramUtrDao,
  getPayInForResetDao,
  getSuccessPayInsDao,
  getPayInForUpdateDao,
  getPayInForTelegramResponseDao,
  getPayinsWithoutHistoryDao,
  getPayInForTelegramResponseArrayDao,
  getPayInIntentDao,
  getPayInsForCronDao,
  // getPayInWithMerchantOrderIdDao,
  // atomicClaimPayInUrlDao,
} from './payInDao.js';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';
import {
  getMerchantLinkBankDao,
  getBankaccountDao,
  getMerchantBankDao,
  updateBankaccountDao,
  getBankaccountPayinDao,
  atomicUpdateBankBalanceDao,
  atomicDecrementBankBalanceDao,
  getBankaccountDaoBatch,
} from '../bankAccounts/bankaccountDao.js';
import {
  getBankResponseDao,
  getBankResponseDaoById,
  getBankResponsePendingBatchDao,
  updateBankResponseDao,
  updateBotResponseDao,
  getBankResponsePayinDao,
  getBankResponseByJustUTRDao,
} from '../bankResponse/bankResponseDao.js';
import {
  getMerchantsByCodeDao,
  getMerchantsDao,
  getMerchantForAssignDao,
  getMerchantForNotifyDao,
  getMerchantsForValidatePayinDao,
  getMerchantByUserIdDao,
  updateMerchantBalanceDao,
  getMerchantsByCodesDao,
} from '../merchants/merchantDao.js';
import {
  getAllCalculationforCronDao,
  getCalculationforCronDao,
  updateCalculationBalanceDao,
} from '../calculation/calculationDao.js';
import {
  getVendorsDao,
  getVendorForAssignDao,
  updateVendorDao,
  getVendorsPayinsDao,
  getVendorsByUserIdsDao,
} from '../vendors/vendorDao.js';
import {
  getImageContentFromOCr,
  getTelegramFilePath,
  getTelegramImageBase64,
} from '../../helpers/index.js';
import {
  sendAlreadyConfirmedMessageTelegramBot,
  sendBankMismatchMessageTelegramBot,
  sendDisputeMessageTelegramBot,
  sendDuplicateMessageTelegramBot,
  sendErrorMessageNoDepositFoundTelegramBot,
  sendErrorMessageNoMerchantOrderIdFoundTelegramBot,
  sendErrorMessageTelegram,
  sendPaymentStatusMessageTelegramBot,
  sendErrorMessageUtrOrAmountNotFoundImgTelegramBot,
  sendMerchantOrderIDStatusDuplicateTelegramMessage,
  sendSuccessMessageTelegramBot,
  sendTelegramMessage,
  sendUTRMismatchErrorMessageTelegram,
  sendTelegramDisputeMessage,
  sendBankNotAssignedAlertTelegram,
} from '../../utils/sendTelegramMessages.js';
import { tableName } from '../../constants/index.js';
import { newTableEntry } from '../../utils/sockets.js';
// import { getConnection } from '../../utils/db.js';
import { _createCheckUtrServiceInternal } from '../checkutr/checkUtrServices.js';
import { _createResetHistoryServiceInternal } from '../resetHistory/resetServices.js';
// import { updateBankaccountService } from '../bankAccounts/bankaccountServices.js';
import { stringifyJSON } from '../../utils/index.js';
import { createHash } from '../../utils/hashUtils.js';
import { logger } from '../../utils/logger.js';
import { publishTelegramOcr } from '../../rabbitmq/producer.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
// import { generateUUID } from '../../utils/generateUUID.js';
// import { randomUUID } from 'crypto';
import { usedTokens } from '../../app.js';
import {
  getCashfreeAllowByCompanyIdDao,
  getCompanyByIDDao,
  // getCompanyDetailsByIdDao,
} from '../company/companyDao.js';
import {
  getUserByCompanyCreatedAtDao,
  getAllUsersDao,
  getUserDao,
} from '../users/userDao.js';
import { trackVendorsNetBalance } from '../../utils/trackVendorsNetBalance.js';
import { createCashfreeOrder } from '../../cashfree/cashfree.js';
import { createRazorPayOrder } from '../../razorpay/razorpay.js';
// import { createZenTechIndTransaction } from '../../zentechind/zentechInd.js';
import { createPaymentTransaction } from '../../intent/createIntentTransaction.js';
// Transaction management imports
import {
  getConnection,
  beginTransaction,
  commit,
  rollback,
} from '../../utils/db.js';
import { createSilkPaymentTransaction } from '../../intent/createSilkIntentTransaction.js';
import {
  deleteCachedData,
  getCachedData,
  setCachedData,
  setCachedDataIfNotExists,
} from '../../utils/redishashkey.js';
import { createOnePayPaymentTransaction } from '../../intent/createOnePayIntentTransaction.js';
import { createCpsPaymentTransaction } from '../../intent/createCpsIntentTransaction.js';
import { createtytlPaymentTransaction } from '../../intent/createtytlPayIntentTransaction.js';
import { createPayeasyTransaction } from '../../intent/createPayeasyIntentTransaction.js';
import { createAlbeCollectTransaction } from '../../intent/createAlbeCollectIntentTransaction.js';
import { createPennyPayTransaction } from '../../intent/createPennyPayTransaction.js';
import { createFreechipsTransaction } from '../../intent/createFreeChipsIntentTransactions.js';
import { getMerchantKeysFromCacheOrDb } from '../../utils/cachedData/getmerchantkeycache.js';
const PAYIN_IDEMPOTENCY_INFLIGHT_TTL_SEC =
  config?.controllerCacheTtls?.payin?.processInflight || 60;
const PAYIN_VALIDATE_MERCHANT_CACHE_TTL_SEC =
  config?.controllerCacheTtls?.merchants?.byId || 20;
const PAYIN_VALIDATE_BANK_CACHE_TTL_SEC =
  config?.controllerCacheTtls?.bankAccounts?.byId || 10;
const PAYIN_VALIDATE_VENDOR_CACHE_TTL_SEC =
  config?.controllerCacheTtls?.vendors?.byId || 60;
const PAYIN_ROUTING_CACHE_TTL_SEC =
  config?.controllerCacheTtls?.bankAccounts?.merchantBank || 60;
const PAYIN_DEPOSIT_STATUS_COOLDOWN_SEC =
  config?.controllerCacheTtls?.payin?.depositStatusCooldown || 3;
const normalizePayInAmount = (amount) => {
  const parsed = Number.parseFloat(amount);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : 'na';
};

const buildPayInProcessIdempotencyBaseKey = (payload = {}) => {
  const merchantOrderId = payload?.merchantOrderId;
  const userSubmittedUtr = payload?.userSubmittedUtr;

  if (!merchantOrderId || !userSubmittedUtr) {
    return null;
  }

  const normalizedUtr = String(userSubmittedUtr).trim().toUpperCase();
  if (!normalizedUtr) {
    return null;
  }

  const amountToken = normalizePayInAmount(payload?.amount);
  return `idem:payin:process:${merchantOrderId}:${normalizedUtr}:${amountToken}`;
};

const getValidatePayinMerchantFromCacheOrDb = async (merchantId) => {
  try {
    if (!merchantId) {
      return [];
    }
    const cacheKey = `payin:validate:merchant:${merchantId}`;
    const cachedMerchant = await getCachedData(
      cacheKey,
      'Payin validate merchant cache',
    );
    if (cachedMerchant) {
      console.log('Returning cached merchant data for merchantId:', merchantId);
      return cachedMerchant;
    }
    const merchantRows = await getMerchantsForValidatePayinDao({ id: merchantId });
    await setCachedData(
      cacheKey,
      merchantRows,
      PAYIN_VALIDATE_MERCHANT_CACHE_TTL_SEC,
      'Payin validate merchant cache',
    );
    return merchantRows;
  } catch (error) {
    logger.error('Error in getValidatePayinMerchantFromCacheOrDb:', error);
    throw error;
  }
};

const getValidatePayinBankAccountFromCacheOrDb = async (bankAccId) => {
  try {
    if (!bankAccId) {
      return [];
    }
    const cacheKey = `payin:validate:bank:${bankAccId}`;
    const cachedBank = await getCachedData(
      cacheKey,
      'Payin validate bank cache',
    );
    if (cachedBank) {
      return cachedBank;
    }
    const bankRows = await getBankaccountPayinDao({ id: bankAccId });
    await setCachedData(
      cacheKey,
      bankRows,
      PAYIN_VALIDATE_BANK_CACHE_TTL_SEC,
      'Payin validate bank cache',
    );
    return bankRows;
  } catch (error) {
    logger.error('Error in getValidatePayinBankAccountFromCacheOrDb:', error);
    throw error;
  }
};

const getValidatePayinVendorFromCacheOrDb = async (userId) => {
  try {
    if (!userId) {
      return [];
    }
    const cacheKey = `payin:validate:vendor:${userId}`;
    const cachedVendor = await getCachedData(
      cacheKey,
      'Payin validate vendor cache',
    );
    if (cachedVendor) {
      return cachedVendor;
    }
    const vendorRows = await getVendorsPayinsDao({ user_id: userId });
    await setCachedData(
      cacheKey,
      vendorRows,
      PAYIN_VALIDATE_VENDOR_CACHE_TTL_SEC,
      'Payin validate vendor cache',
    );
    return vendorRows;
  } catch (error) {
    logger.error('Error in getValidatePayinVendorFromCacheOrDb:', error);
    throw error;
  }
};

export const generatePayInUrlByHashService = async (req) => {
  try {
    const { user_id, code, ot, amount } = req.query;
    const { role_id, role } = req.user;
    if (!user_id || !code || !ot) {
      const data = {
        status: 400,
        message: 'Missing required query parameters: user_id, code, or ot',
      };
      return data;
    }
    // const x_api_key = req.headers['x-api-key'];
    const merchantArr = await getMerchantsByCodeDao(code);
    if (merchantArr.length === 0) {
      const data = {
        status: 404,
        message: 'Merchant is inactive. Contact support for help!',
      };
      return data;
    }
    if (merchantArr[0]?.config?.is_h2h && !amount) {
      throw new NotFoundError('amount is required');
    }
    const bankAssigned = await getMerchantBankDao({
      config_merchants_contains: merchantArr[0].id,
      company_id: merchantArr[0].company_id,
      is_obsolete: false,
    });
    const [company] = await getCompanyByIDDao({
      id: merchantArr[0].company_id,
    });
    if (merchantArr[0]?.config?.allow_intent) {
      const validIntentBanks = bankAssigned.filter((bank) => {
        const intent = bank?.config?.is_intent;
        return intent && intent !== 'off' && intent !== false;
      });
      if (validIntentBanks.length === 0) {
        await sendBankNotAssignedAlertTelegram(
          company.config?.telegramBankAlertChatId,
          code,
          company.config?.telegramBotToken,
        );
        return {
          status: 404,
          message: 'Intent Bank account not found for the given merchant',
        };
      }
    }
    if (bankAssigned.length <= 0) {
      await sendBankNotAssignedAlertTelegram(
        company.config?.telegramBankAlertChatId,
        code,
        company.config?.telegramBotToken,
      );
      const data = {
        status: 404,
        message: 'Bank Account has not been linked with Merchant',
      };
      return data;
    }

    // bank is not enabled or no method is enabled for payment - no payment link generates
    //loop over each and cehck
    const allBanksDisabled = bankAssigned.every(
      (bank) => bank.is_enabled === false,
    );
    if (allBanksDisabled) {
      await sendBankNotAssignedAlertTelegram(
        company.config?.telegramBankAlertChatId,
        code,
        company.config?.telegramBotToken,
      );
      const data = {
        status: 404,
        message: 'Bank Account has not been linked with Merchant',
      };
      return data;
    }
    //loop over evrey bank
    const allPaymentOptionsDisabled = bankAssigned.every((bank) => {
      if (!bank.is_enabled) return true;
      const config = bank.config || {};
      const isPhonepay = config.is_phonepay || false;
      const isIntent =
        (config.is_intent !== undefined &&
          config.is_intent !== 'off' &&
          config.is_intent !== false) ||
        false;
      return (
        isPhonepay === false &&
        bank.is_qr === false &&
        bank.is_bank === false &&
        isIntent === false
      );
    });

    if (allPaymentOptionsDisabled) {
      const data = {
        status: 404,
        message: 'No Payment Methods Enabled!',
      };
      return data;
    }

    let query = `user_id=${user_id}&code=${code}&ot=${ot}`;
    if (amount) {
      query += `&amount=${amount}`;
    }
    if (role || role === Role.ADMIN || role === Role.MERCHANT) {
      query += `&token=${role_id}`;
    }

    // Create a deterministic hash
    // const hash = createHash(`${code}:${key}`);

    // Encode the hash to make it URL-safe
    // const encodedHash = encodeURIComponent(hash);

    const updateRes = {
      payInUrl: `${config.reactPaymentOrigin}/transaction?${query}`,
    };
    return updateRes;
  } catch (error) {
    logger.error('Error generating payin hash:', error);
    throw error;
  }
};
const createPayInWithUniqueShortCode = async (data) => {
  let attempts = 0;
  while (attempts < 10) {
    attempts += 1;
    try {
      return await generatePayInUrlDao({
        ...data,
        upi_short_code: nanoid(5),
      });
    } catch (error) {
       if (error.code === '23505' && error.message?.includes('merchant_order_id')) {
        throw new BadRequestError('Merchant Order ID already exists');
      }
      if (error.code === '23505') {
        continue;
      }
      throw error;
    }
  }
  throw new Error('Unable to generate unique short code after 10 attempts');
};

const isBankDisabled = (bank) => bank.is_enabled === false;

const isPaymentMethodDisabled = (bank) => {
  if (!bank.is_enabled) return true;

  const config = bank.config || {};
  return (
    !config.is_phonepay &&
    !config.is_intent &&
    bank.is_qr === false &&
    bank.is_bank === false
  );
};

const triggerBankAlert = async (company, code) => {
  try {
    return await sendBankNotAssignedAlertTelegram(
      company.config?.telegramBankAlertChatId,
      code,
      company.config?.telegramBotToken,
    );
  } catch (error) {
    logger.error('Error triggering bank alert:', error);
  }
};

export const determineType = (bankAssigned) => {
  const allObjects = bankAssigned.flat();
  const hasQr = allObjects.some((obj) => obj.is_qr === true);
  if (hasQr) {
    return 'upi';
  }
  const hasBank = allObjects.some((obj) => obj.is_bank === true);
  if (hasBank) {
    return 'bank_transfer';
  }
  return 'upi';
};

export const generatePayInUrlService = async (payload, role) => {
  try {
    const {
      code,
      user_id,
      merchant_order_id: order_id,
      amount,
      returnUrl,
      notifyUrl,
      ot,
      api_key,
      _merchantData,
    } = payload;

    const merchant_order_id = order_id ? order_id : uuidv4();

    // Cache merchant routing data to reduce repeated DB reads under load.
    // Merchant config and bank assignments change rarely; 60s TTL is safe.
    const routingCacheKey = `merchant_routing:${code}:${createHash(code + ':' + (api_key || ''))}`;
    let merchant, company, bankAssigned;

    const cachedRouting = await getCachedData(
      routingCacheKey,
      'merchant_routing',
    );
    if (cachedRouting) {
      ({ merchant, company, bankAssigned } = cachedRouting);
    } else {
      const merchantArr = _merchantData ? [_merchantData] : await getMerchantsByCodeDao(code);
      merchant = merchantArr[0];
      if (!merchant) {
        return {
          status: 400,
          message: 'Invalid merchant code',
        };
      }

      // Parallelize company + bank fetch — they only need merchant.company_id / merchant.id
      const [companyRows, rawBankAssigned] = await Promise.all([
        getCompanyByIDDao({ id: merchant.company_id }),
       getMerchantBankDao({
                config_merchants_contains: merchant.id,
                company_id: merchant.company_id,
                is_obsolete: false,
              }),
      ]);
      company = companyRows[0];
      bankAssigned = rawBankAssigned ?? [];

      // Cache the routing bundle
      await setCachedData(
        routingCacheKey,
        { merchant, company, bankAssigned },
        PAYIN_ROUTING_CACHE_TTL_SEC,
        'merchant_routing',
      );
    }

    const type = determineType(bankAssigned);

    if (bankAssigned.length === 0) {
      await triggerBankAlert(company, code);
      return {
        status: 404,
        message: 'Bank Account has not been linked with Merchant',
      };
    }

    if (bankAssigned?.every(isBankDisabled)) {
      return {
        status: 404,
        message: 'All Assigned Banks are Disabled!',
      };
    }

    // all payment methods disabled
    if (bankAssigned?.every(isPaymentMethodDisabled)) {
      await triggerBankAlert(company, code);
      return {
        status: 404,
        message: 'No Payment Methods Enabled!',
      };
    }

    // if (merchant?.config?.whitelist_ips) {
    //   // normalize whitelist to a clean array of strings
    //   const whitelist = []
    //     .concat(merchant.config.whitelist_ips) // handles string or array
    //     .flatMap((ip) =>
    //       typeof ip === 'string' ? ip.split(',') : [String(ip)],
    //     )
    //     .map((ip) => ip.trim())
    //     .filter(Boolean);

    //   // If whitelist ip's exists and user IP is not allowed
    //   if (
    //     whitelist.length > 0 &&
    //     !whitelist.includes(userIp) &&
    //     role !== Role.ADMIN
    //   ) {
    //     return {
    //       status: 400,
    //       message: 'IP not whitelisted',
    //     };
    //   }
    // }


    // const { keys: merchantKeys } = merchant.config || {};
    // if (
    //   api_key &&
    //   api_key !== merchantKeys?.private &&
    //   api_key !== merchantKeys?.public
    // ) {
    //   return { status: 404, message: 'Enter valid Api key' };
    // }

    if (
      role !== Role.ADMIN &&
      (amount < merchant.min_payin || amount > merchant.max_payin)
    ) {
      return {
        status: 400,
        message: `Amount must be between ${merchant.min_payin} and ${merchant.max_payin}`,
      };
    }

    const expirationDate = dayjs()
      .add(ot === 'y' ? 10 : 30, ot === 'y' ? 'minute' : 'day')
      .toISOString();

    let admin;
    if (role === Role.ADMIN) {
      admin = await getUserByCompanyCreatedAtDao(merchant.company_id, role);
    }
    let bankAccId = null;
    let assignedBankData = null;
    const amt = Number(amount || 0);
    if (merchant?.config?.allow_intent) {
      const validIntentBanks = bankAssigned.filter((bank) => {
        const intent = bank?.config?.is_intent;
        return intent && intent !== 'off' && intent !== false;
      });
      if (validIntentBanks.length === 0) {
        await triggerBankAlert(company, code);
        return {
          status: 404,
          message: 'Bank account not found for the given merchant',
        };
      }
      const randomBank =
        validIntentBanks[Math.floor(Math.random() * validIntentBanks.length)];
      bankAccId = randomBank.id;
    }
    // For H2H merchants: find valid bank for amount
    if (merchant.config?.is_h2h) {
      const banksWithValidAmount = bankAssigned.filter((bank) => {
        const isPayInBank = ['PayIn', 'payIn'].includes(bank.bank_used_for);
        const isActive = bank.is_enabled && isPayInBank;
        if (!isActive) return false;
        return amt >= Number(bank.min) && amt <= Number(bank.max);
      });
      if (banksWithValidAmount.length === 0) {
        await triggerBankAlert(company, code);
        return {
          status: 404,
          message: 'Bank account not found for the given merchant',
        };
      }
      const randomBank = banksWithValidAmount[Math.floor(Math.random() * banksWithValidAmount.length)];
      bankAccId = randomBank.id;
      if (type === BankTypes.BANK_TRANSFER) {
        assignedBankData = {
          bank: {
            nick_name: randomBank.nick_name,
            acc_holder_name: randomBank.acc_holder_name,
            acc_no: randomBank.acc_no,
            ifsc: randomBank.ifsc,
          },
        };
      } else {
        assignedBankData = {
          bank: {
            upi_id: randomBank.upi_id,
            acc_holder_name: randomBank.acc_holder_name,
            code: nanoid(5),
          },
        };
      }
    }

    const data = {
      amount: amt || 0,
      status: bankAccId ? Status.ASSIGNED : Status.INITIATED,
      currency: Currency.INR,
      merchant_order_id,
      user: user_id,
      merchant_id: merchant.id,
      expiration_date: expirationDate,
      company_id: merchant.company_id,
      bank_acc_id: bankAccId,
      config: stringifyJSON({
        urls: {
          return: returnUrl || merchant.config?.urls?.return || '',
          notify: notifyUrl || merchant.config?.urls?.payin_notify || '',
        },
      }),
      created_by: role === Role.ADMIN ? admin.id : merchant?.user_id,
    };

    const result = await createPayInWithUniqueShortCode(data);

    const responseObj = {
      ...result,
      merchant_details: { merchant_code: merchant?.code || null },
      bank_res_details: { utr: null, amount: 0 },
    };

    setImmediate(() => {
      newTableEntry(tableName.PAYIN, responseObj).catch((err) =>
        logger.error('Socket emit failed:', err),
      );
    });
    // Return H2H response with bank details
    if (merchant.config?.is_h2h && assignedBankData) {
      return {
        ...result,
        status: Status.INITIATED,
        merchant: { h2h: merchant?.config?.is_h2h || false },
        bank: assignedBankData.bank,
        type: type,
      };
    }

    return result;
  } catch (error) {
    logger.error('Error generating payin url:', error);
    throw error;
  }
};

export const getPayInUrlService = async (
  id,
  tele_check = true,
  conn = null,
  payInUrl = null,
) => {
  try {
    const currentTime = Date.now();
    const payIn = payInUrl
      ? payInUrl
      : await getPayinsForServiccDao({ merchant_order_id: id }, conn);

    if (!payIn) {
      throw new NotFoundError('Payment Url is incorrect');
    }
    // Skip expiration check if tele_check is false
    if (payIn.is_url_expires && tele_check) {
      if (payIn.one_time_used === true || payIn.is_url_expires === true) {
        const result = {
          redirect_url: payIn.config?.urls?.return,
        };
        return { error: `Url is expired`, result };
      }
    }
    const config = payIn.config || {};
    if (
      currentTime > Number(payIn.expiration_date) &&
      payIn.status !== Status.INITIATED
    ) {
      // expire payIn
      await updatePayInUrlDao(
        id,
        {
          is_url_expires: true,
          status: Status.DROPPED,
        },
        conn,
      );

      const Key = await getMerchantKeysFromCacheOrDb(id);
      const secretKey = Key?.private || null;
      const api_version = Key?.api_version || 'v1';

      const callbackPayload = {
        status: Status.DROPPED,
        merchantOrderId: payIn.merchant_order_id,
        payinId: payIn.id,
        amount: null,
        ...(api_version === 'v2'
          ? {
              reqAmount: payIn.amount,
              utrId: payIn.utr,
            }
          : {
              req_amount: payIn.amount,
              utr_id: payIn.utr,
            }),
      };


      // Notifying merchant about expired URL
      // This is async function but it's just the callback sending function there fore we are not using await
      merchantPayinCallback(config.urls?.notify, callbackPayload , secretKey);
      // throw new InternalServerError('PayIn Expired');
    }

    return payIn;
  } catch (error) {
    logger.error('Error get payin url:', error);
    throw error;
  }
};

// TODO: delete this API
export const expirePayInUrlService = async (payInId) => {
  try {
    // const currentTime = Date.now();
    const payIn = await getPayinsForServiccDao({ id: payInId });
    const Key = await getMerchantKeysFromCacheOrDb(payIn.merchant_id );
    const secretKey = Key?.private || null;
    const api_version = Key?.api_version || 'v1';
    if (!payIn) {
      throw new NotFoundError('PayIn not found!');
    }
    checkIsPayInExpired(payIn);
    const config = payIn.config || {};
    await updatePayInUrlDao(payInId, {
      is_url_expires: true,
      status: Status.DROPPED,
    });

    const callbackPayload = {
      status: Status.DROPPED,
      merchantOrderId: payIn.merchant_order_id,
      payinId: payIn.id,
      amount: null,
      ...(api_version === 'v2'
        ? {
            reqAmount: payIn.amount,
            utrId: payIn.utr,
          }
        : {
            req_amount: payIn.amount,
            utr_id: payIn.utr,
          }),
    };

    // This is async function but it's just the callback sending function there fore we are not using await
    merchantPayinCallback(config.urls?.notify, callbackPayload, secretKey);
  } catch (error) {
    logger.error('Error expire payin url:', error);
    throw error;
  }
};

export const assignedBankToPayInUrlService = async (
  merchantOrderId,
  amount,
  type,
  isAdmin,
) => {
  // Validate the PayIn URL
  try {
    logger.info(
      `Verifying PayIn with merchantOrderId: ${merchantOrderId}, amount: ${amount}, type: ${type}, isAdmin: ${isAdmin}`,
    );
    const payIn = await getPayInUrlService(merchantOrderId);
    const payInConfig = payIn.config || {};
    checkIsPayInExpired(payIn);
    if (payIn.status !== Status.INITIATED) {
      if (payIn.status === Status.ASSIGNED) {
        const bank = await getBankaccountDao({
          id: payIn.bank_acc_id,
          company_id: payIn.company_id,
        });
        let response = {
          return: payIn.config?.urls?.return,
        };
        if (
          Number(amount) > Number(bank[0].min) &&
          Number(amount) < Number(bank[0].max)
        ) {
          if (type === BankTypes.BANK_TRANSFER) {
            response = {
              bank: {
                nick_name: bank[0].nick_name,
                acc_holder_name: bank[0].acc_holder_name,
                acc_no: bank[0].acc_no,
                ifsc: bank[0].ifsc,
              },
            };
          } else {
            response = {
              bank: {
                upi_id: bank[0].upi_id,
                acc_holder_name: bank[0].acc_holder_name,
                code: payIn.upi_short_code,
              },
            };
          }
        }
        return response;
      } else {
        throw new BadRequestError('PayIn has been confirmed already!');
      }
    }
    const [merchant, banks] = await Promise.all([
      getMerchantForAssignDao(payIn.merchant_id),
      getMerchantBankDao({
        config_merchants_contains: payIn.merchant_id,
        company_id: payIn.company_id,
        is_obsolete: false,
      }),
    ]);
    if (!merchant) {
      throw new NotFoundError('No merchant found');
    }
    const maxPayIn = Number(merchant.max_payin);
    const minPayIn = Number(merchant.min_payin);
    const amt = Number(amount);

    if ((amt > maxPayIn || amt < minPayIn) && !isAdmin) {
      //-- exact amounts should also be considered
      throw new BadRequestError(
        `Amount must be between ${minPayIn} and ${maxPayIn}`,
      );
    }

    // First, check if any bank satisfies the amount condition
    const banksWithValidAmount = banks.filter((bank) => {
      const isPayInBank = ['PayIn', 'payIn'].includes(bank.bank_used_for);
    
      const isActive =
        bank.is_enabled &&
        isPayInBank;
      if (!isActive) return false;
      return amt >= Number(bank.min) && amt <= Number(bank.max);
    });

    // If no bank satisfies the amount condition, check for enabled banks to provide appropriate error
    if (banksWithValidAmount.length === 0) {
      await updatePayInUrlDao(payIn.id, {
        is_url_expires: true,
        status: Status.FAILED,
      });

      const callbackPayload = {
        status: Status.FAILED,
        merchantOrderId: payIn.merchant_order_id,
        payinId: payIn.id,
        amount: null,
        ...(merchant.config?.apiVersion  === 'v2'
          ? {
              reqAmount: payIn.amount,
              utrId: payIn.utr,
            }
          : {
              req_amount: payIn.amount,
              utr_id: payIn.utr,
            }),
      };

      merchantPayinCallback(payInConfig.urls?.notify, callbackPayload , merchant.config?.keys?.private);
      throw new NotFoundError(
        `No bank found with valid amount range for ${amt}!`,
      );
    }

    //only enabled banks assigned with valid amount, method support, and type matching
    const enabledBanks = banksWithValidAmount.filter((bank) => {
      const config = bank.config || {};
      const hasAnyMethod =
        bank.is_qr ||
        bank.is_bank ||
        config.is_phonepay ||
        config.is_intent ||
        false;

      if (!hasAnyMethod) return false;

      switch (type) {
        case BankTypes.UPI:
          return bank.is_qr;
        case BankTypes.PHONE_PE:
          return config.is_phonepay || false;
        case BankTypes.BANK_TRANSFER:
          return bank.is_bank;
        case BankTypes.INTENT:
          return config.is_intent || false;
        default:
          return false;
      }
    });

    if (!enabledBanks.length) {
      await updatePayInUrlDao(payIn.id, {
        is_url_expires: true,
        status: Status.DROPPED,
      });

      const callbackPayload = {
        status: Status.DROPPED,
        merchantOrderId: payIn.merchant_order_id,
        payinId: payIn.id,
        amount: null,
        ...(merchant.config?.apiVersion  === 'v2'
          ? {
              reqAmount: payIn.amount,
              utrId: payIn.utr,
            }
          : {
              req_amount: payIn.amount,
              utr_id: payIn.utr,
            }),
      };

      // This is async function but it's just the callback sending function there fore we are not using await
      merchantPayinCallback(payInConfig.urls?.notify, callbackPayload, merchant.config?.keys?.private || null);
      throw new NotFoundError(`No enabled bank found!`);
    }
    // Randomly assign one enabled bank account
    const selectedBankDetails =
      enabledBanks[Math.floor(Math.random() * enabledBanks.length)];
    logger.info(
      `Bank assigned for PayIn ${payIn.id}: ${selectedBankDetails.nick_name} (${selectedBankDetails.id})`,
    );
    const duration = calculateDuration(payIn.created_at);
    const updatePayIn = await updatePayInUrlDao(payIn.id, {
      amount: parseFloat(amount),
      status: Status.ASSIGNED,
      bank_acc_id: selectedBankDetails.id,
      duration: duration,
      config:{...payIn.config,
          assigned_bank: {
            acc_no: selectedBankDetails?.acc_no,
            upi_id: selectedBankDetails?.upi_id,
          },
      }
    });

    const vendor = await getVendorForAssignDao(selectedBankDetails.user_id);

    const responseObj = {
      ...updatePayIn,
      bank_acc_id: selectedBankDetails.id,
      nick_name: selectedBankDetails.nick_name || '',
      vendor_code: vendor?.code || null,
      vendor_user_id: vendor?.user_id || null,
      merchant_details: {
        merchant_code: merchant ? merchant.code : null,
        dispute: merchant && merchant[0] ? merchant[0].dispute : null,
        return_url: payIn.config?.urls?.return || null,
        notify_url: payIn.config?.urls?.notify || null,
      },
      bank_res_details: {
        utr: null,
        amount: 0,
      },
      upi_id: selectedBankDetails.upi_id || null,
      company_id: payIn.company_id,
    };
    // Emit socket event for assigned payin
    await newTableEntry(tableName.PAYIN, responseObj);
    // expirePayInIfNeeded(payIn);
    delete updatePayIn.is_obsolete;
    delete updatePayIn.company_id;
    delete selectedBankDetails.is_obsolete;
    delete updatePayIn.company_id;

    Object.assign(updatePayIn, {
      merchant_min_payin: merchant.min_payin,
      merchant_max_payin: merchant.max_payin,
      merchant_code: merchant.code,
      allow_merchant_intent: merchant.config?.allow_intent,
      code: updatePayIn.upi_short_code,
      bank: selectedBankDetails,
    });

    let response;
    if (type === BankTypes.BANK_TRANSFER) {
      response = {
        return: updatePayIn.config?.urls?.return,
        bank: {
          nick_name: selectedBankDetails.nick_name,
          acc_holder_name: selectedBankDetails.acc_holder_name,
          acc_no: selectedBankDetails.acc_no,
          ifsc: selectedBankDetails.ifsc,
        },
      };
    } else {
      response = {
        return: updatePayIn.config?.urls?.return,
        bank: {
          upi_id: selectedBankDetails.upi_id,
          acc_holder_name: selectedBankDetails.acc_holder_name,
          code: updatePayIn.upi_short_code,
        },
      };
      if (selectedBankDetails.config.is_staticQR) {
        response.bank.staticQR = selectedBankDetails.config.is_staticQR;
      }
    }

    return response;
  } catch (error) {
    logger.error('Error assigned payin url:', error);
    throw error;
  }
};

// Public API Used by Merchants
export const checkPayInStatusService = async (
  payInId,
  merchantCode,
  merchantOrderId,
  api_key,
) => {
  try {
    const merchantArr = await getMerchantsDao({ code: merchantCode });
    const merchant = merchantArr[0];
    if (!merchant) {
      const data = {
        status: 400,
        message: 'Merchant Order ID already exists',
      };
      return data;
    }

    const merchantConfig = merchant.config || {};

    if (
      api_key != merchantConfig.keys?.private &&
      api_key != merchantConfig.keys?.public
    ) {
      const data = {
        status: 404,
        message: 'Enter valid Api key',
      };
      return data;
    }

    const payIn = await getPayInForCheckStatusDao({
      id: payInId,
      merchant_order_id: merchantOrderId,
    });

    if (!payIn) {
      const data = {
        status: 404,
        message: 'PayIn not found',
      };
      return data;
    }

    //check is payIn detials belongs to that merchant or not
    if (!(payIn.merchant_id === merchant.id)) {
      const data = {
        status: 404,
        message:
          'merchant_order_id and payIn ID do not belong to the specified merchant',
      };
      return data;
    }

    let botResponse;
    if (payIn.bank_response_id) {
      botResponse = await getBankResponseDao({
        id: payIn.bank_response_id,
        company_id: payIn.company_id,
      });
    }

    return {
      status: payIn.status,
      merchantOrderId: payIn.merchant_order_id,
      amount: [
        Status.INITIATED,
        Status.ASSIGNED,
        Status.DROPPED,
        Status.DUPLICATE,
      ].includes(payIn.status)
        ? null
        : botResponse?.amount
          ? botResponse?.amount
          : null,
      payinId: payIn.id,
      req_amount: payIn.amount,
      utr_id: [
        Status.INITIATED,
        Status.ASSIGNED,
        Status.DROPPED,
        Status.IMG_PENDING,
      ].includes(payIn.status)
        ? ' '
        : botResponse?.utr
          ? botResponse?.utr
          : payIn.user_submitted_utr,
    };
  } catch (error) {
    logger.error('Error check payin:', error);
    throw error;
  }
};

export const payInIntentGenerateOrderService = async (
  merchantOrderId,
  // company_id,
  amount,
  provider,
) => {
  try {
    const payIn = await getPayInIntentDao(merchantOrderId);
    checkIsPayInExpired(payIn);
    const providerHandlers = {
      ZenTechInd: async () => {
        const order = await createPaymentTransaction(
          'zentechind',
          payIn,
          amount,
        );
        return order?.payment_url;
      },
      silkPay: async () => {
        const order = await createSilkPaymentTransaction(
          'silkPay',
          payIn,
          amount,
        );
        return order?.paymentUrl;
      },
      Freechips: async () => {
        const order = await createFreechipsTransaction(
          'freechips',
          payIn,
          amount,
        );
        return order?.url;
      },
      NMPLPay: async () => {
        const order = await createPaymentTransaction('nmplPay', payIn, amount);
        return order?.payment_url;
      },
      runsafe: async () => {
        const order = await createOnePayPaymentTransaction(
          'runsafe',
          payIn,
          amount,
        );
        return order?.link;
      },
      cpsPay: async () => {
        const order = await createCpsPaymentTransaction('cps', payIn, amount);
        return order?.upiIntend;
      },
      tytl: async () => {
        const order = await createtytlPaymentTransaction('tytl', payIn, amount);
        return order?.url;
      },
      orvixPay: async () => {
        const order = await createPaymentTransaction('orvixPay', payIn, amount);
        return order?.payment_url;
      },
      orvixPay1: async () => {
        const order = await createPaymentTransaction(
          'orvixPay1',
          payIn,
          amount,
        );
        return order?.payment_url;
      },
      Cashfree: async () => {
        const order = await createCashfreeOrder(payIn, amount);
        return order?.payment_session_id;
      },
      Razorpay: async () => {
        const order = await createRazorPayOrder(payIn, amount);
        return order?.id;
      },
      Payeasy: async () => {
        const order = await createPayeasyTransaction('payeasy', payIn, amount);
        return order?.url;
      },
      Payeasy02: async () => {
        const order = await createPayeasyTransaction(
          'payeasy02',
          payIn,
          amount,
        );
        return order?.url;
      },
      Payeasy03: async () => {
        const order = await createPayeasyTransaction(
          'payeasy03',
          payIn,
          amount,
        );
        return order?.url;
      },
      pennyPay: async () => {
        const order = await createPennyPayTransaction('pennyPay', payIn, amount);
        return order?.url;
      },
      trustPay: async () => {
        const order = await createPennyPayTransaction('trustPay', payIn, amount);
        return order?.url;
      },
      payBitra: async () => {
        const order = await createPennyPayTransaction('payBitra', payIn, amount);
        return order?.url;
      },
      payCric: async () => {
        const order = await createPennyPayTransaction('payCric', payIn, amount);
        return order?.url;
      },
      albeCollect: async () => {
        const order = await createAlbeCollectTransaction('albeCollect', payIn, amount);
        return order?.data?.paymentLink || null;
      },
    };
    const handler = providerHandlers[provider];
    if (!handler) {
      throw new NotFoundError(`No handler found for provider: ${provider}`);
    }

    const session_id = await handler();

    if (!session_id) {
      throw new NotFoundError(`No session_id found for provider: ${provider}`);
    }

    const response = {
      id: payIn.id,
      return: payIn.config?.urls?.return || '',
    };
    if (provider === 'albeCollect') {
      response.paymentLink = session_id;
    } else {
      response.session_id = session_id;
    }
    return response;
  } catch (error) {
    logger.error('Error generate intent payin:', error.message);
    throw error;
  }
};

export const updatePaymentNotificationStatusService = async (
  payInId,
  type,
  company_id,
) => {
  try {
    if (!Object.values(Type).includes(type)) {
      throw new BadRequestError('Invalid notification type.');
    }

    let data;
    if (type === Type.PAYIN) {
      const payIn = await updatePayInUrlDao(payInId, { is_notified: true });
      if (!payIn) {
        throw new NotFoundError('Payin data not found.');
      }

      const bankResponse = await getBankResponseDao({
        id: payIn.bank_response_id,
        company_id,
      });

       const Key = await getMerchantKeysFromCacheOrDb(payIn.merchant_id);
        const secretKey = Key?.private || null;
        const api_version = Key?.api_version || 'v1';

        const callbackPayload = {
          status: payIn.status,
          merchantOrderId: payIn.merchant_order_id,
          payinId: payIn.id,
          amount: bankResponse?.amount || null,
          ...(api_version  === 'v2'
            ? {
                reqAmount: payIn.amount,
                utrId: bankResponse?.utr ? bankResponse.utr : payIn.user_submitted_utr,
              }
            : {
                req_amount: payIn.amount,
                utr_id: bankResponse?.utr ? bankResponse.utr : payIn.user_submitted_utr,
              }),
        };

      data = await merchantPayinCallback(payIn.config?.urls?.notify, callbackPayload, secretKey);
    } else if (type === Type.PAYOUT) {
      // find on the basis of payoutId
      // const payouts = await getPayoutsDao({ id: payInId, company_id });
      const payouts = await getPayoutsNotifyDao({ id: payInId, company_id });
      const payout = payouts[0];
      if (!payout) {
        throw new NotFoundError('Payout data not found.');
      }
      const merchants = await getMerchantForNotifyDao({
        id: payout.merchant_id,
        company_id,
      });
      const merchant = merchants[0];
      if (!merchant) {
        throw new NotFoundError('Merchant or payout notify URL not found.');
      }
      const Key = await getMerchantKeysFromCacheOrDb(merchant.id);
      const secretKey = Key?.private || null;
      const api_version = Key?.api_version || 'v1';
      ///payout notify url change
      data = await merchantPayoutCallback(
        payouts[0].payout_details.urls.notify,
        {
          merchantOrderId: payout.merchant_order_id,
          payoutId: payout.id,
          amount: payout.amount,
          status: payout.status,
          ...(api_version === 'v2'
            ? {
                utrId: payout.utr,
              }
            : {
                code: merchant.code,
                utr_id: payout.utr,
              }),
        },secretKey
      );
    }
    return data;
  } catch (error) {
    logger.error('Error updating payment status notification:', error);
    throw error;
  }
};

export const updateDepositStatusService = async (
  merchantOrderId,
  nick_name,
  company_id,
  updated_by,
) => {
  // Guard: check cooldown BEFORE acquiring a DB connection so we never open a
  // transaction that we immediately abandon (which contaminates the pool).
  const KEY_PREFIX = company_id;
  const cacheKey = `${KEY_PREFIX}:${merchantOrderId}`;
  const HOLD_TIME = PAYIN_DEPOSIT_STATUS_COOLDOWN_SEC;
  const cooldownActive = await getCachedData(cacheKey);
  if (cooldownActive) {
    logger.log(`Duplicate merchantOrderId ${merchantOrderId}  ${HOLD_TIME}s`);
    return;
  }
  await setCachedData(cacheKey, '1', HOLD_TIME);

  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const payInData = await getPayInForUpdateServiceDao(
      {
        merchant_order_id: merchantOrderId,
        company_id,
      },
      conn,
    );
    if (!payInData) {
      throw new NotFoundError('PayIn data not found');
    }
    const merchants = await getMerchantsDao(
      {
        id: payInData.merchant_id,
        company_id,
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      conn,
    );

    // need to check pay in is for merchant or vendor
    const merchant = merchants[0];

    if (!merchant) {
      throw new NotFoundError('No merchant found against payIn');
    }

    if (payInData.status !== Status.BANK_MISMATCH) {
      throw new BadRequestError(
        'Status is not BANK_MISMATCH, no update applied',
      );
    }

    //call the Bank Res API
    const bankResponse = await getBankResponseDao(
      {
        id: payInData.bank_response_id,
        company_id,
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      conn,
    );

    if (!bankResponse) {
      throw new NotFoundError('No bank response found!');
    }
    let duration;

    const banks = await getBankaccountDao(
      { nick_name, company_id },
      undefined,
      undefined,
      undefined,
      undefined,
      conn,
    );
    const bank = banks[0];

    if (!bank) {
      throw new NotFoundError('Bank not found!');
    }

    const vendors = await getVendorsDao(
      {
        user_id: bank.user_id,
        company_id,
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      conn,
    );
    const vendor = vendors[0];
    //calculate the payin commission
    const payinCommission = calculateCommission(
      bankResponse.amount,
      merchant.payin_commission,
    );
    const vendorPayinCommission = calculateCommission(
      bankResponse.amount,
      vendor.payin_commission,
    );

    let successData = [];
    if (bankResponse.is_used) {
      successData = await getOtherSuccessPayIns(bankResponse, true, conn);
    }
    duration = calculateDuration(payInData.created_at);
    const updatePayInData = {
      status:
        bank.id != bankResponse.bank_id
          ? Status.BANK_MISMATCH
          : parseFloat(bankResponse.amount) !== parseFloat(payInData.amount)
            ? Status.DISPUTE
            : successData.length
              ? Status.DUPLICATE
              : Status.SUCCESS,
      bank_acc_id: bank.id,
      config:{ ...payInData.config , assigned_bank: { acc_no: bank.acc_no, upi_id: bank.upi_id }},
      duration: duration,
      updated_by,
    };

    if (updatePayInData.status === Status.SUCCESS) {
      // Handle sub-vendor and parent commission logic
      // let totalVendorCommission = vendorPayinCommission;
      // let brokerageCommission = 0;
      // let parentCommission = 0;

      // const subVendorParentInfo = await getSubVendorParentInfo(vendor);
      // if (subVendorParentInfo) {
      //   // Calculate parent commission
      //   parentCommission = await updateParentVendorCalculation(
      //     subVendorParentInfo.parentUserId,
      //     Number(payInData.amount),
      //     Number(subVendorParentInfo.parentVendor.payin_commission),
      //     conn,
      //   );

      //   totalVendorCommission = vendorPayinCommission + parentCommission;
      //   brokerageCommission = parentCommission;

      //   updatePayInData.config = {
      //     ...payInData.config,
      //     actual_vendor_commission: vendorPayinCommission,
      //     brokerage_commission: brokerageCommission,
      //   };
      //   logger.info(
      //     `Sub-vendor commission calculated: sub=${vendorPayinCommission}, parent=${parentCommission}, total=${totalVendorCommission}`,
      //   );
      // } else {
      //   updatePayInData.config = {
      //     ...payInData.config,
      //     actual_vendor_commission: vendorPayinCommission,
      //   };
      // }

      updatePayInData.approved_at = new Date();
      updatePayInData.payin_merchant_commission = payinCommission;
      updatePayInData.payin_vendor_commission = vendorPayinCommission;

      // update merchant calculation table
      await updateCalculationTable(
        merchant.user_id,
        {
          amount: payInData.amount,
          payinCommission: payinCommission,
        },
        conn,
      );

      // update vendor caclulation table
      // await updateCalculationTable(
      //   bank.user_id,
      //   {
      //     amount: payInData.amount,
      //     payinCommission: vendorPayinCommission,
      //   },
      //   conn,
      // );

      // update merchant balance
      // await updateMerchantBalanceDao(
      //   { id: merchant.id },
      //   payInData.amount,
      //   updated_by,
      //   conn,
      // );

      // update vendor balance
      // await updateVendorBalanceDao(
      //   { user_id: bank.user_id },
      //   payInData.amount,
      //   updated_by,
      //   conn,
      // );
    }

    const updatePayInRes = await updatePayInUrlDao(
      payInData.id,
      updatePayInData,
      conn,
    );

    await updateBotResponseDao({ id: bank.id }, { is_used: true }, conn);

    // Build complete response object for socket
    const socketResponseObj = {
      id: payInData.id,
      sno: updatePayInRes.sno || payInData.sno,
      amount: updatePayInRes.amount || payInData.amount || 0,
      status: updatePayInRes.status,
      user_submitted_utr:
        updatePayInRes.user_submitted_utr || bankResponse.utr || null,
      user_submitted_image: updatePayInRes.user_submitted_image || null,
      duration: updatePayInRes.duration || 0,
      nick_name: bank.nick_name || '',
      bank_acc_id: updatePayInRes.bank_acc_id || payInData.bank_acc_id || null,
      payin_merchant_commission: updatePayInRes.payin_merchant_commission || 0,
      payin_vendor_commission: updatePayInRes.payin_vendor_commission || 0,
      merchant_details: {
        merchant_code: merchant?.code || '',
        dispute: updatePayInRes.status === Status.DISPUTE,
        return_url: payInData.config?.urls?.return || null,
        notify_url: payInData.config?.urls?.notify || null,
      },
      merchant_order_id:
        updatePayInRes.merchant_order_id || payInData.merchant_order_id,
      merchant_id: payInData.merchant_id,
      payin_details: {
        urls: payInData.config?.urls || {},
        user: payInData.config?.user || {},
      },
      upi_id:payInData?.config?.assigned_bank?.upi_id || null,
      vendor_code: vendor?.code || null,
      vendor_user_id: vendor?.user_id || null,
      upi_short_code:
        updatePayInRes.upi_short_code || payInData.upi_short_code || null,
      is_url_expires: updatePayInRes.is_url_expires || false,
      approved_at: updatePayInRes.approved_at || null,
      created_by: updatePayInRes.created_by || payInData.created_by || null,
      updated_by: updatePayInRes.updated_by || null,
      is_notified: updatePayInRes.is_notified || false,
      user: updatePayInRes.user || payInData.user || null,
      created_at: updatePayInRes.created_at || payInData.created_at,
      updated_at: updatePayInRes.updated_at || new Date().toISOString(),
      bank_res_details: {
        utr: bankResponse.utr || null,
        amount: bankResponse.amount || 0,
      },
      company_id: payInData.company_id,
    };
    newTableEntry(tableName.PAYIN, socketResponseObj);

    const callbackPayload = {
      status: updatePayInRes.status,
      merchantOrderId: updatePayInRes.merchant_order_id,
      payinId: updatePayInRes.id,
      amount: bankResponse.amount,
      ...(merchant.config?.apiVersion  === 'v2'
        ? {
            reqAmount: payInData.amount,
            utrId: bankResponse.utr,
          }
        : {
            req_amount: payInData.amount,
            utr_id: bankResponse.utr,
          }),
    };

    // update bank balance and today balance
    // const bankBalance =
    //   updatePayInData.status === Status.DISPUTE
    //     ? bankResponse.amount
    //     : payInData.amount;

    // await updateBanktBalanceDao({ id: bank.id }, bankBalance, updated_by, conn);

    // await updateBankaccountService(
    //   conn,
    //   { id: bank.id, company_id: payInData.company_id },
    //   {},
    // );
    // This is async function but it's just the callback sending function there fore we are not using await
    merchantPayinCallback(updatePayInRes.config?.urls?.notify, callbackPayload, merchant.config?.keys?.private);


    await commit(conn);
    committed = true;
    return;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error updating deposit status:', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

export const resetDepositService = async (
  merchant_order_id,
  company_id,
  updated_by,
) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const payIn = await getPayInForResetDao(
      {
        merchant_order_id: merchant_order_id,
        company_id: company_id,
      },
      conn,
    );
    if (!payIn) {
      throw new NotFoundError('Merchant Order ID not found');
    }
    await _createResetHistoryServiceInternal(
      {
        payin_id: payIn.id,
        pre_status: payIn.status,
        created_by: updated_by,
        updated_by,
        company_id,
      },
      conn,
      // merchant_order_id,
    );

    const nonResettableStatuses = new Set([
      Status.SUCCESS,
      Status.FAILED,
      Status.ASSIGNED,
      Status.DROPPED,
      Status.INITIATED,
      Status.BANK_MISMATCH,
      Status.DISPUTE,
    ]);

    if (nonResettableStatuses.has(payIn.status)) {
      throw new BadRequestError(
        `The Order Id: ${payIn.merchant_order_id} with Status: ${payIn.status} cannot be reset!`,
      );
    }

    const condition = {
      company_id,
    };
    if (payIn.bank_response_id) {
      condition.id = payIn.bank_response_id;
    } else {
      condition.utr = payIn.user_submitted_utr;
    }
    const bankResponse = await getBankResponseDao(
      condition,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      conn,
    );
    const duration = calculateDuration(payIn.created_at);
    const updatePayInData = {
      status: calculateStatus(payIn.created_at),
      payin_merchant_commission: null,
      user_submitted_utr: null,
      bank_response_id: null,
      duration: duration,
      updated_by,
    };

    if (bankResponse && bankResponse.is_used) {
      // check if any entry exists
      const payInSuccess = await getOtherSuccessPayIns(
        bankResponse,
        undefined,
        conn,
      );
      ///for update bankresponse with id
      const id = bankResponse.id;
      if (!payInSuccess.length && payIn.status != Status.DUPLICATE) {
        await updateBotResponseDao(id, { is_used: false }, conn);
      }
    }

    const result = await updatePayInUrlDao(payIn.id, updatePayInData, conn);
    await commit(conn);
    committed = true;
    return result;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error reset deposit service:', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const calculateStatus = (createdAt) => {
  const TEN_MINUTES_IN_MS = 10 * 60 * 1000;
  const currentTime = new Date();
  const createdTime = new Date(createdAt);
  const timeDifference = currentTime - createdTime;

  return timeDifference > TEN_MINUTES_IN_MS ? Status.DROPPED : Status.ASSIGNED;
};

export const getPayinsBySearchService = async (
  filters,
  role,
  user_id,
  designation,
  updatedPayin,
) => {
  try {
    const fetchMerchantIds = async (user_ids) => {
      const merchants = await getMerchantByUserIdDao(user_ids);
      return merchants.map((merchant) => merchant.id);
    };

    const fetchBankIds = async (user_ids) => {
      try {
        // Handle both single user_id and array of user_ids
        const userIdArray = Array.isArray(user_ids) ? user_ids : [user_ids];

        const allBanks = [];
        for (const userId of userIdArray) {
          const banks = await getBankaccountDao({
            user_id: userId,
            bank_used_for: 'PayIn',
          });
          if (banks && banks.length > 0) {
            allBanks.push(...banks);
          }
        }

        if (allBanks.length === 0) {
          return [];
        }
        return allBanks.map((bank) => bank.id);
      } catch (error) {
        logger.error('Error fetching PayIn:', error);
        return [];
      }
    };

    let merchant_user_id = role === Role.MERCHANT ? [user_id] : [];

    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao(
        { user_id },
        null,
        null,
        null,
        null,
        null,
        null,
      );
      const userHierarchy = userHierarchys?.[0];

      if (designation === Role.MERCHANT && userHierarchy) {
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        if (Array.isArray(subMerchants) && subMerchants.length > 0) {
          merchant_user_id = [...merchant_user_id, ...subMerchants];
          filters.merchant_id = await fetchMerchantIds(merchant_user_id);
        } else {
          filters.merchant_id = await fetchMerchantIds([user_id]);
        }
      } else if (designation === Role.SUB_MERCHANT) {
        filters.merchant_id = await fetchMerchantIds([user_id]);
      } else if (designation === Role.MERCHANT_OPERATIONS && userHierarchy) {
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao(
            {
              user_id: parentID,
            },
            null,
            null,
            null,
            null,
            null,
            null,
          );
          const parentHierarchy = parentHierarchys?.[0];
          const subMerchants =
            parentHierarchy?.config?.siblings?.sub_merchants ?? [];

          const userIdFilter = [...new Set([parentID, ...subMerchants])];
          filters.merchant_id = await fetchMerchantIds(userIdFilter);
        }
      }
    } else if (role === Role.VENDOR || role === Role.SUB_VENDOR) {
      if (designation === Role.VENDOR_ADMIN || designation === Role.VENDOR) {
        const userHierarchys = await getUserHierarchysDao(
          { user_id },
          null,
          null,
          null,
          null,
          null,
          null,
        );
        const userHierarchy = userHierarchys?.[0];

        const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];
        if (Array.isArray(subVendors) && subVendors.length > 0) {
          const vendorUserIds = [user_id, ...subVendors];
          filters.bank_acc_id = await fetchBankIds(vendorUserIds);
        } else {
          filters.bank_acc_id = await fetchBankIds(user_id);
        }
      } else if (designation === Role.SUB_VENDOR) {
        filters.bank_acc_id = await fetchBankIds(user_id);
      } else if (designation === Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao(
          { user_id },
          null,
          null,
          null,
          null,
          null,
          null,
        );
        const userHierarchy = userHierarchys?.[0];
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao(
            {
              user_id: parentID,
            },
            null,
            null,
            null,
            null,
            null,
            null,
          );
          const parentHierarchy = parentHierarchys?.[0];
          const subVendors =
            parentHierarchy?.config?.siblings?.sub_vendors ?? [];

          const userIdFilter = [...new Set([parentID, ...subVendors])];
          filters.bank_acc_id = await fetchBankIds(userIdFilter);
        }
      }
    }

    const pageNum = parseInt(filters.page);
    const limitNum = parseInt(filters.limit);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }
    let searchTerms = [];
    if (filters.search || filters.search === '') {
      searchTerms = filters.search
        .split(',')
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
    }

    // if (searchTerms.length === 0) {
    //   throw new BadRequestError('Please provide valid search terms');
    // }
    const offset = (pageNum - 1) * limitNum;

    if (
      (designation === Role.VENDOR ||
        designation === Role.VENDOR_OPERATIONS ||
        designation === Role.SUB_VENDOR ||
        designation === Role.VENDOR_ADMIN) &&
      Array.isArray(filters.bank_acc_id) &&
      filters.bank_acc_id.length === 0
    ) {
      return [];
    }
    let data;
    if (updatedPayin) {
      data = await getPayinsWithHistoryDao(
        filters,
        searchTerms,
        limitNum,
        offset,
        role,
        designation,
        updatedPayin,
      );
    } else {
      data = await getPayinsWithoutHistoryDao(
        filters,
        searchTerms,
        limitNum,
        offset,
        role,
        designation,
      );
    }

    return data;
  } catch (error) {
    logger.error('Error while fetching Payin by search', error);
    throw error;
  }
};

export const getPayinsSummaryService = async (filters) => {
  try {
    const data = await getPayinsSumAndCountByStatusDao(filters);
    return data;
  } catch (error) {
    logger.error('Error while fetching Payin SUM', error);
    throw error;
  }
};

export const _processPayInServiceInternal = async (
  payload,
  updated_by,
  tele_check = true,
  img_utr = false,
  designation,
  h2h,
  conn = null,
  img_utr_fileKey = null,
) => {
  const {
    userSubmittedUtr,
    merchantOrderId,
    amount,
    from_telegram,
    telegramMessage,
    telegramBotToken,
    user_submitted_image,
    // : payload.fileKey
  } = payload;
  // validate payIn
  // throw error if not exist or expires
  const orderid = merchantOrderId;
  await checkLockEdit(orderid, true, conn);
  if (h2h) {
    const payin = await getPayInsForCronDao(
      {
        merchant_order_id: merchantOrderId,
      },
      conn,
    );
    if (payin.length == 0) {
      throw new NotFoundError('Invalid Order Id');
    }
    if (payin[0].status != 'ASSIGNED') {
      throw new BadRequestError('Payment is Expired');
    }
    if (payin[0].amount != payload.amount) {
      throw new BadRequestError('Please Enter Valid Amount');
    }
  }
  const payIn = await getPayInUrlService(merchantOrderId, tele_check, conn);
  const Key = await getMerchantKeysFromCacheOrDb(payIn.merchant_id);
  const secretKey = Key?.private
  const api_version = Key?.api_version || 'v1';
  if (
    Object.keys(payIn).length === 2 &&
    'error' in payIn &&
    'result' in payIn
  ) {
    return payIn;
  }
  if (
    (payIn.one_time_used === true || payIn.is_url_expires === true) &&
    tele_check
  ) {
    const result = {
      redirect_url: payIn.config?.urls?.return,
    };
    return { error: `This payin url is already used`, result };
  }

  logger.info(
    `PayIn: ${JSON.stringify(payIn)} found for merchantOrderId: ${merchantOrderId}`,
  );
  //lock payin transaction
  // Validate that we have valid values for lock key
  if (!payIn.bank_acc_id || !userSubmittedUtr) {
    throw new BadRequestError(
      'Missing bank_acc_id or userSubmittedUtr for transaction lock',
    );
  }
  const lockKey = `${payIn.bank_acc_id}${userSubmittedUtr}`;
  await checkLockEdit(lockKey, true, conn);
  const banks = await getValidatePayinBankAccountFromCacheOrDb(
    payIn?.bank_acc_id
  );
  const bank = banks[0];

  if (!bank) {
    throw new NotFoundError('Bank not found!');
  }

  // Fetch vendor for vendor_code
  const vendors = await getValidatePayinVendorFromCacheOrDb(
    bank.user_id
  );
  const vendor = vendors[0];

  const duration = calculateDuration(payIn.created_at);
  let otherPayIns = await getPayInForDuplicate(
    {
      merchant_order_id: merchantOrderId,
      user_submitted_utr: userSubmittedUtr,
      company_id: payIn.company_id,
    },
    conn,
  );
  if (
    (!otherPayIns || otherPayIns.length === 0) &&
    (tele_check || img_utr_fileKey)
  ) {
    otherPayIns = await getPayInForDuplicate(
      {
        user_submitted_utr: userSubmittedUtr,
        company_id: payIn.company_id,
      },
      conn,
    );
  }
  const updatePayInData = {
    amount,
    //img_utr only for updating utr directly when image uploaded
    user_submitted_utr:
      tele_check || img_utr
        ? userSubmittedUtr
        : payIn?.user_submitted_utr
          ? payIn?.user_submitted_utr
          : null,
    status:
      img_utr && payIn.status === Status.IMG_PENDING ? 'PENDING' : payIn.status,
    is_url_expires: true,
    one_time_used: true,
    duration,
    user_submitted_image: user_submitted_image || payIn.user_submitted_image,
    is_notified: true,
    updated_by: updated_by || '',
  };
  let bankResponse = {};
  if (payIn.bank_response_id) {
    bankResponse =
      (await getBankResponseDao(
        { id: payIn.bank_response_id },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        conn,
      )) || {};
  } else if (!bankResponse || !bankResponse.utr) {
    const statuses =
      designation === Role.ADMIN ? ['/success', '/freezed'] : ['/success'];
    bankResponse =
      (await getBankResponsePayinDao(
        {
          utr: userSubmittedUtr,
          status: statuses,
          company_id: payIn.company_id,
        },
        conn,
      )) || {};
  }
  const result = {
    status: payIn.status,
    merchantOrderId: payIn.merchant_order_id,
    payinId: payIn.id,
    amount: bankResponse.amount || null,
    ...(api_version === 'v2'
      ? {
          reqAmount: payIn.amount,
          utrId: payIn.user_submitted_utr,
        }
      : {
          req_amount: payIn.amount,
          utr_id: payIn.user_submitted_utr,
        }),
  };

  if (
    [
      Status.SUCCESS,
      Status.DUPLICATE,
      Status.DISPUTE,
      Status.BANK_MISMATCH,
    ].includes(payIn.status)
  ) {
    if (payIn.status === Status.DUPLICATE) {
      (api_version === 'v2' ? 
        result.utrId = bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr : 
        result.utr_id = bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr
      );
    }

    // This is async function but it's just the callback sending function there fore we are not using await
    merchantPayinCallback(payIn.config?.urls?.notify, result, secretKey);
    return result;
  }
  if (otherPayIns.length || bankResponse.is_used) {
    updatePayInData.status = Status.DUPLICATE;
    result.status = Status.DUPLICATE;
    updatePayInData.duration = duration;
    (api_version === 'v2' ? 
      result.utrId = bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr : 
      result.utr_id = bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr
    );
    await updatePayInUrlDao(payIn.id, updatePayInData, conn);

    const responseObj = {
      id: payIn.id,
      sno: payIn.sno,
      amount: amount || 0,
      status: updatePayInData.status,
      user_submitted_utr: updatePayInData.user_submitted_utr || null,
      user_submitted_image: updatePayInData.user_submitted_image || null,
      duration: updatePayInData.duration || 0,
      nick_name: bank.nick_name || '',
      bank_acc_id: updatePayInData.bank_acc_id || null,
      merchant_order_id: payIn.merchant_order_id,
      company_id: payIn.company_id,
      vendor_code: vendor?.code || null,
      user: payIn.user || null,
      merchant_id: payIn.merchant_id,
      vendor_user_id: vendor?.user_id || null,
      bank_res_details: {
        utr: bankResponse.utr || null,
        amount: bankResponse.amount || 0,
      },
      upi_id: payIn.config?.assigned_bank?.upi_id || null,
      created_at: payIn.created_at,
      updated_at: new Date().toISOString(),
      updated_by: updated_by || null,
      bank_response_id: bankResponse.id || null,
      is_url_expires: true,
    };

    await newTableEntry(tableName.PAYIN, responseObj);

    // This is async function but it's just the callback sending function there fore we are not using await
    merchantPayinCallback(payIn.config?.urls?.notify, result, secretKey);
    return {
      ...result,
      message: 'Duplicate entry found!',
    };
  }

  if (!bankResponse || Object.keys(bankResponse).length === 0) {
    const statuses =
      designation === Role.ADMIN ? ['/success', '/freezed'] : ['/success'];
    bankResponse =
      (await getBankResponsePayinDao(
        {
          utr: userSubmittedUtr,
          status: statuses,
          company_id: payIn.company_id,
        },
        conn,
      )) || {};
  }

  if (bankResponse.id) {
    await updateBotResponseDao(
      bankResponse.id,
      {
        is_used: true,
        status: '/success',
      },
      conn,
    );
  }

  if (bankResponse.bank_id && bankResponse.bank_id !== payIn.bank_acc_id) {
    updatePayInData.status = Status.BANK_MISMATCH;
    updatePayInData.bank_response_id = bankResponse.id;
    updatePayInData.duration = duration;
    // updatePayInData.approved_at = new Date().toISOString();
    result.status = Status.BANK_MISMATCH;
    (api_version === 'v2' ? 
      result.utrId = bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr : 
      result.utr_id = bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr
    );
    await updatePayInUrlDao(payIn.id, updatePayInData, conn);

    const responseObj = {
      id: payIn.id,
      sno: payIn.sno,
      amount: amount || 0,
      status: updatePayInData.status,
      user_submitted_utr: updatePayInData.user_submitted_utr || null,
      user_submitted_image: updatePayInData.user_submitted_image || null,
      duration: updatePayInData.duration || 0,
      user: payIn.user || null,
      nick_name: bank.nick_name || '',
      merchant_id: payIn.merchant_id,
      vendor_code: vendor?.code || null,
      vendor_user_id: vendor?.user_id || null,
      bank_acc_id: updatePayInData.bank_acc_id || null,
      merchant_order_id: payIn.merchant_order_id,
      company_id: payIn.company_id,
      upi_id: payIn.config?.assigned_bank?.upi_id || null,
      bank_res_details: {
        utr: bankResponse.utr || null,
        amount: bankResponse.amount || 0,
      },
    };

    await newTableEntry(tableName.PAYIN, responseObj);
    const obj = {
      id: bankResponse.id,
      data: { ...bankResponse, is_used: true },
      company_id: payIn.company_id,
    };
    await newTableEntry(tableName.BANK_RESPONSE, obj);

    // This is async function but it's just the callback sending function there fore we are not using await
    merchantPayinCallback(payIn.config?.urls?.notify, result, secretKey);

    if (from_telegram) {
      const botBank = await getBankaccountDao(
        { id: bankResponse.bank_id },
        undefined,
        undefined,
        undefined,
        undefined,
        conn,
      );
      await sendBankMismatchMessageTelegramBot(
        telegramMessage.chat.id,
        payIn?.bank_acc_id ? bank.nick_name : 'null',
        botBank[0].nick_name,
        telegramBotToken,
        telegramMessage.message_id,
      );
      return true;
    } else {
      return {
        ...result,
        message: `${payIn.merchant_order_id} is in Bank Mismatched with ${payIn.user_submitted_utr || bankResponse.utr} `,
      };
    }
  }

  if (bankResponse.id) {
    updatePayInData.status =
      parseFloat(amount) === parseFloat(bankResponse.amount)
        ? Status.SUCCESS
        : Status.DISPUTE;
    updatePayInData.bank_response_id = bankResponse.id;
    updatePayInData.approved_at =
      updatePayInData.status == Status.SUCCESS
        ? new Date().toISOString()
        : null;
    result.amount = bankResponse.amount;
    (api_version === 'v2' ? 
      result.utrId = bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr : 
      result.utr_id = bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr
    );
  } else {
    updatePayInData.status = Status.PENDING;
    (api_version === 'v2' ? 
      result.utrId = bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr : 
      result.utr_id = bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr
    );
  }

  result.status = updatePayInData.status;

  let merchant;
  merchant = await getMerchantsDao(
    { id: payIn.merchant_id },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    conn,
  );
  if (updatePayInData.status === Status.SUCCESS) {
    // update merchant balance
    // await updateMerchantBalanceDao(
    //   { id: payIn.merchant_id },
    //   bankResponse.amount,
    //   updated_by,
    //   conn,
    // );
    // update vendor balance
    // await updateVendorBalanceDao(
    //   { user_id: bank.user_id },
    //   bankResponse.amount,
    //   updated_by,
    //   conn,
    // );

    // merchant = await getMerchantsDao({ id: payIn.merchant_id });
    const commissions = calculateCommission(
      bankResponse.amount,
      Number(merchant[0].payin_commission),
    );
    updatePayInData.payin_merchant_commission = Number(commissions);
    const bank = await getValidatePayinBankAccountFromCacheOrDb(
      bankResponse?.bank_id
    );
    const vendors = await getValidatePayinVendorFromCacheOrDb(
      bank[0].user_id);
    const vendor = vendors[0];
    const vendorCommission = calculateCommission(
      bankResponse.amount,
      Number(vendor.payin_commission),
    );

    // Handle sub-vendor and parent commission logic
    // let totalVendorCommission = vendorCommission;
    // let brokerageCommission = 0;
    // let parentCommission = 0;

    // const subVendorParentInfo = await getSubVendorParentInfo(vendor);
    // if (subVendorParentInfo) {
    //   // Calculate parent commission
    //   // parentCommission = await updateParentVendorCalculation(
    //   //   subVendorParentInfo.parentUserId,
    //   //   Number(bankResponse.amount),
    //   //   Number(subVendorParentInfo.parentVendor.payin_commission),
    //   //   conn,
    //   // );

    //   totalVendorCommission = vendorCommission + parentCommission;
    //   brokerageCommission = parentCommission;

    //   updatePayInData.config = {
    //     ...payIn.config,
    //     actual_vendor_commission: vendorCommission,
    //     brokerage_commission: brokerageCommission,
    //   };

    //   logger.info(
    //     `Sub-vendor commission calculated: sub=${vendorCommission}, parent=${parentCommission}, total=${totalVendorCommission}`,
    //   );
    // } else {
    //   updatePayInData.config = {
    //     ...payIn.config,
    //     actual_vendor_commission: vendorCommission,
    //   };
    // }
    updatePayInData.payin_vendor_commission = Number(vendorCommission);

    await updateCalculationTable(
      merchant[0].user_id,
      {
        payinCommission: Number(commissions),
        amount: Number(bankResponse.amount),
      },
      conn,
    );
    // await updateCalculationTable(
    //   bank.user_id,
    //   {
    //     payinCommission: vendorCommission,
    //     amount: bankResponse.amount,
    //   },
    //   conn,
    // );
  }

  // if (updatePayInData.status === Status.DISPUTE) {
  // update bank balance
  // (updated_by = updated_by ? updated_by : bank.updated_by),
  //   await updateBanktBalanceDao(
  //     { id: bank.id },
  //     payIn.amount,
  //     updated_by,
  //     conn,
  //   );
  // await updateBankaccountService(
  //   conn,
  //   { id: bank.id, company_id: payIn.company_id },
  //   {},
  // );
  // }

  await updatePayInUrlDao(payIn.id, updatePayInData, conn);
  // After updating payin, build the response object

  const responseObj = {
    id: payIn.id,
    sno: payIn.sno,
    amount: amount || 0,
    status: updatePayInData.status,
    user_submitted_utr: updatePayInData.user_submitted_utr || null,
    user_submitted_image: updatePayInData.user_submitted_image || null,
    duration: updatePayInData.duration || 0,
    merchant_id: payIn.merchant_id,
    nick_name: bank.nick_name || '',
    vendor_user_id: vendor?.user_id || null,
    bank_acc_id: updatePayInData.bank_acc_id || null,
    payin_merchant_commission: updatePayInData.payin_merchant_commission || 0,
    merchant_details: {
      merchant_code: merchant && merchant[0] ? merchant[0].code : null,
      dispute: updatePayInData.status === Status.DISPUTE,
      return_url: payIn.config?.urls?.return || null,
      notify_url: payIn.config?.urls?.notify || null,
    },
    merchant_order_id: payIn.merchant_order_id,
    payin_details: {
      urls: payIn.config?.urls || {},
      user: payIn.config?.user || {},
    },
    bank_res_details: {
      utr: bankResponse.utr || null,
      amount: bankResponse.amount || 0,
    },
    upi_id: payIn.config?.assigned_bank?.upi_id || null,
    user: payIn.user || null,
    updated_at: payIn.updated_at,
    created_at: payIn.created_at,
    vendor_code: vendor?.code || null,
    company_id: payIn.company_id,
  };

  await newTableEntry(tableName.PAYIN, responseObj);
  const obj = {
    id: bankResponse.id,
    data: { ...bankResponse, is_used: true },
    company_id: payIn.company_id,
  };
  if (
    bankResponse.id &&
    (updatePayInData.status === Status.SUCCESS ||
      updatePayInData.status === Status.DISPUTE)
  ) {
    await newTableEntry(tableName.BANK_RESPONSE, obj);
  }

  // This is async function but it's just the callback sending function there fore we are not using await
  merchantPayinCallback(payIn.config?.urls?.notify, result, secretKey);

  if (from_telegram) {
    if (
      !updatePayInData?.status ||
      !telegramMessage?.chat?.id ||
      !telegramBotToken
    ) {
      throw new BadRequestError('Missing required parameters');
    }

    try {
      switch (updatePayInData.status) {
        case Status.DISPUTE:
          await sendDisputeMessageTelegramBot(
            telegramMessage.chat.id,
            updatePayInData.amount,
            bankResponse.amount,
            telegramBotToken,
            telegramMessage.message_id,
          );
          break;
        case Status.DUPLICATE:
          await sendDuplicateMessageTelegramBot(
            telegramMessage.chat.id,
            updatePayInData.user_submitted_utr,
            payIn.merchant_order_id,
            telegramBotToken,
            telegramMessage.message_id,
          );
          break;
        default:
          await sendSuccessMessageTelegramBot(
            telegramMessage.chat.id,
            payIn.merchant_order_id,
            telegramBotToken,
            telegramMessage.message_id,
          );
          break;
      }
    } catch (error) {
      logger.error('Error handling Telegram message:', error);
    }
    // if (
    //   [
    //     Status.SUCCESS,
    //     Status.BANK_MISMATCH,
    //     Status.DISPUTE,
    //     Status.DROPPED,
    //   ].includes(payIn.status)
    // ) {
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: payIn.company_id,
    //   message: `Payin with merchant order id: ${payIn.merchant_order_id} has been updated.`,
    //   payloadUserId: merchant[0].user_id,
    //   actorUserId: bank.user_id,
    //   category: 'Transaction',
    //   subCategory: 'PayIn',
    // });
    // }
  }

  return result;
};

export const processPayInService = async (
  payload,
  updated_by,
  tele_check = true,
  img_utr = false,
  designation,
  h2h,
  img_utr_fileKey,
) => {
  let conn;
  let committed = false;
  const idempotencyBaseKey = buildPayInProcessIdempotencyBaseKey(payload);
  const inflightKey = idempotencyBaseKey
    ? `${idempotencyBaseKey}:inflight`
    : null;

  try {
    if (inflightKey) {
      const inflightAcquired = await setCachedDataIfNotExists(
        inflightKey,
        {
          merchantOrderId: payload?.merchantOrderId,
          userSubmittedUtr: payload?.userSubmittedUtr,
          amount: payload?.amount,
          startedAt: new Date().toISOString(),
        },
        PAYIN_IDEMPOTENCY_INFLIGHT_TTL_SEC,
        'payin_process_idempotency_inflight',
      );

      if (!inflightAcquired) {
        return {
          status: Status.PENDING,
          merchantOrderId: payload?.merchantOrderId,
          req_amount: payload?.amount,
          utr_id: payload?.userSubmittedUtr || null,
          idempotent: true,
          message: 'PayIn is already being processed',
        };
      }
    }

    conn = await getConnection();
    await beginTransaction(conn);
    const result = await _processPayInServiceInternal(
      payload,
      updated_by,
      tele_check,
      img_utr,
      designation,
      h2h,
      conn,
      img_utr_fileKey,
    );
    await commit(conn);
    committed = true;

    return result;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error processing PayIn:', error);
    throw error;
  } finally {
    if (inflightKey) {
      await deleteCachedData(
        inflightKey,
        'payin_process_idempotency_inflight',
      );
    }
    if (conn) conn.release();
  }
};

export const processPayInWebHookService = async (payload, updated_by, conn) => {
  try {
    const { userSubmittedUtr, merchantOrderId, amount, status } = payload;

    const payIn = await getPayinsForServiccDao(
      {
        merchant_order_id: merchantOrderId,
      },
      conn,
    );
    const Key = await getMerchantKeysFromCacheOrDb(payIn.merchant_id);
    const secretKey = Key?.private
    const api_version = Key?.api_version || 'v1';
    const [bank] = await getBankaccountDao(
      {
        id: payIn?.bank_acc_id,
        company_id: payIn.company_id,
      },
      null,
      null,
      null,
      null,
      conn,
    );
    let bankResponse = await getBankResponseByJustUTRDao(
      userSubmittedUtr,
      conn,
    );
    const [vendor] = await getVendorsDao(
      { user_id: bank.user_id },
      null,
      null,
      null,
      null,
      null,
      conn,
    );
    let [merchant] = await getMerchantsDao(
      { id: payIn.merchant_id },
      null,
      null,
      null,
      null,
      null,
      conn,
    );

    const upperStatus = status.toUpperCase();
    const finalStatus =
      upperStatus === 'USER_DROPPED' ? Status.DROPPED : upperStatus;

    const duration = calculateDuration(payIn.created_at);
    const updatePayInData = {
      amount,
      user_submitted_utr: userSubmittedUtr,
      status: finalStatus,
      bank_response_id: bankResponse?.id,
      is_url_expires: true,
      one_time_used: true,
      duration,
      is_notified: true,
      updated_by: updated_by || '',
      approved_at:
        finalStatus === Status.SUCCESS ? new Date().toISOString() : null,
    };

    if (finalStatus === Status.SUCCESS) {
      // Handle sub-vendor and parent commission logic
      const merchantCommission = calculateCommission(
        bankResponse.amount,
        Number(merchant.payin_commission),
      );
      const vendorCommission = calculateCommission(
        bankResponse.amount,
        Number(vendor?.payin_commission),
      );

      // let totalVendorCommission = vendorCommission;
      // let brokerageCommission = 0;
      // let parentCommission = 0;

      // const subVendorParentInfo = await getSubVendorParentInfo(vendor);
      // if (subVendorParentInfo) {
      //   // Calculate parent commission
      //   // parentCommission = await updateParentVendorCalculation(
      //   //   subVendorParentInfo.parentUserId,
      //   //   Number(bankResponse.amount),
      //   //   Number(subVendorParentInfo.parentVendor.payin_commission),
      //   //   conn,
      //   // );

      //   totalVendorCommission = vendorCommission + parentCommission;
      //   brokerageCommission = parentCommission;

      //   updatePayInData.config = {
      //     ...payIn.config,
      //     actual_vendor_commission: vendorCommission,
      //     brokerage_commission: brokerageCommission,
      //   };

      //   logger.info(
      //     `Sub-vendor commission calculated: sub=${vendorCommission}, parent=${parentCommission}, total=${totalVendorCommission}`,
      //   );
      // } else {
      //   updatePayInData.config = {
      //     ...payIn.config,
      //     actual_vendor_commission: vendorCommission,
      //   };
      // }

      updatePayInData.approved_at = new Date();
      updatePayInData.payin_merchant_commission = merchantCommission;
      updatePayInData.payin_vendor_commission = vendorCommission;

      await updateCalculationTable(
        merchant.user_id,
        {
          payinCommission: merchantCommission,
          amount: Number(bankResponse.amount),
        },
        conn,
      );
    }

    await updatePayInUrlDao(payIn.id, updatePayInData, conn);

    const result = {
      status: finalStatus,
      merchantOrderId: payIn.merchant_order_id,
      payinId: payIn.id,
      amount: bankResponse.amount || null,
      ...(api_version === 'v2'
        ? {
            reqAmount: payIn.amount,
            utrId: payIn.user_submitted_utr || userSubmittedUtr,
          }
        : {
            req_amount: payIn.amount,
            utr_id: payIn.user_submitted_utr || userSubmittedUtr,
          }),
    };
    logger.info('Webhook processing result:', result);

    const responseObj = {
      id: payIn.id,
      sno: payIn.sno,
      amount: amount || 0,
      status: finalStatus,
      user_submitted_utr: userSubmittedUtr || null,
      duration: duration || 0,
      merchant_id: payIn.merchant_id,
      nick_name: bank.nick_name || '',
      vendor_user_id: vendor?.user_id || null,
      bank_acc_id: payIn.bank_acc_id || null,
      payin_merchant_commission: updatePayInData.payin_merchant_commission || 0,
      merchant_details: {
        merchant_code: merchant?.code || null,
        dispute: finalStatus === Status.DISPUTE,
        return_url: payIn.config?.urls?.return || null,
        notify_url: payIn.config?.urls?.notify || null,
      },
      merchant_order_id: payIn.merchant_order_id,
      payin_details: {
        urls: payIn.config?.urls || {},
        user: payIn.config?.user || {},
      },
      bank_res_details: {
        utr: bankResponse.utr || null,
        amount: bankResponse.amount || 0,
      },
      upi_id: payIn.config?.assigned_bank?.upi_id || null,
      user: payIn.user || null,
      updated_at: payIn.updated_at,
      created_at: payIn.created_at,
      vendor_code: vendor?.code || null,
      company_id: payIn.company_id,
    };

    await newTableEntry(tableName.PAYIN, responseObj);

    // This is async function but it's just the callback sending function there fore we are not using await
    merchantPayinCallback(payIn.config?.urls?.notify, result, secretKey);

    return result;
  } catch (error) {
    logger.error('Error processing PayIn:', error);
    throw error;
  }
};

// const calculateCommissions = async (merchantId, vendorId, amount) => {
//   const merchant = await getMerchantsDao({ id: merchantId });
//   const vendor = await getVendorsDao({ user_id: vendorId });

//   return {
//     payin_merchant_commission: calculateCommission(
//       amount,
//       merchant[0]?.payin_commission,
//     ),
//     payin_vendor_commission: calculateCommission(
//       amount,
//       vendor[0]?.payin_commission,
//     ),
//   };
// };

// When enabled, the Telegram OCR webhook payload is processed off the API
// process by the RabbitMQ worker (durable, retry + DLQ) instead of running the
// heavy OCR + DB transaction inline after the 200 response. Default off keeps
// the current inline behavior; on a publish failure we fall back to inline so a
// screenshot is never dropped.
const OCR_QUEUE_ENABLED =
  String(process.env.OCR_QUEUE_ENABLED || '').toLowerCase() === 'true';

/**
 * Entry point used by the telegram-ocr webhook controller. Routes the message
 * to the durable queue when OCR_QUEUE_ENABLED, else (or on publish failure)
 * processes it inline via telegramResponseService.
 */
export const dispatchTelegramResponse = async (message) => {
  if (OCR_QUEUE_ENABLED) {
    try {
      await publishTelegramOcr({ message });
      return;
    } catch (error) {
      logger.error('[Telegram][OCR] Enqueue failed; processing inline', {
        error: error.message,
      });
      // fall through to inline processing so the screenshot is not lost
    }
  }

  await telegramResponseService(message);
};

export const telegramResponseService = async (message) => {
  // Guard: validate photo before acquiring a DB connection so we never open a
  // transaction that we immediately abandon (which contaminates the pool).
  const { photo } = message;
  const TELEGRAM_BOT_TOKEN = config.telegramOcrBotToken;
  if (!photo) {
    logger.error('No Telegram Message Photo found!', message);
    return;
  }

  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);

    const lastPhoto = Array.isArray(photo) ? photo.pop() : photo;
    const filePath = await getTelegramFilePath(lastPhoto?.file_id);
    const image = await getTelegramImageBase64(filePath);
    const content = await getImageContentFromOCr(image);
    sendTelegramMessage(
      message.chat?.id,
      content,
      TELEGRAM_BOT_TOKEN,
      message.message_id,
    );
    if (!content || !content.utr || !content.amount) {
      sendErrorMessageUtrOrAmountNotFoundImgTelegramBot(
        message.chat?.id,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
      );
      await rollback(conn);
      return;
    }

    if (!message.caption) {
      sendErrorMessageNoMerchantOrderIdFoundTelegramBot(
        message.chat?.id,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
      );
      await rollback(conn);
      return;
    }

    // Fetch initial data concurrently
    // const [payIn, bankResponse] = await Promise.all([
    //   getPayInForTelegramResponseDao({ merchant_order_id: message.caption }),
    //   getBankResponseDao({ utr: content.utr }),
    // ]);
    const payIn = await getPayInForTelegramResponseDao(
      {
        merchant_order_id: message.caption,
      },
      conn,
    );
    const bankResponse = await getBankResponseDao(
      {
        utr: content.utr,
        company_id: payIn?.company_id,
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      conn,
    );
    // Early validation for missing critical data
    if (!payIn) {
      await sendErrorMessageTelegram(
        message.chat?.id,
        message.caption,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
      );
      await rollback(conn);
      return;
    }
    if (!bankResponse) {
      await sendErrorMessageNoDepositFoundTelegramBot(
        message.chat?.id,
        content.utr,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
      );
      await rollback(conn);
      return;
    }
    if (payIn.status === Status.FAILED) {
      await sendPaymentStatusMessageTelegramBot(
        message.chat?.id,
        message.caption,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
        Status.FAILED,
      );
      await rollback(conn);
      return;
    }
    if (payIn.status === Status.INITIATED) {
      await sendPaymentStatusMessageTelegramBot(
        message.chat?.id,
        message.caption,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
        Status.INITIATED,
      );
      await rollback(conn);
      return;
    }
    // Fetch related pay-in URLs concurrently
    const [otherBankResponsePayIns, otherUtrPayIns, otherBotResponsePayIns] =
      await Promise.all([
        payIn.bank_response_id
          ? getPayInForTelegramResponseArrayDao(
              {
                bank_response_id: payIn.bank_response_id,
              },
              conn,
            )
          : Promise.resolve([]),
        getPayInForTelegramResponseArrayDao(
          {
            user_submitted_utr: content.utr,
            company_id: payIn?.company_id,
          },
          conn,
        ),
        bankResponse.id
          ? getPayInForTelegramResponseArrayDao(
              {
                bank_response_id: bankResponse.id,
              },
              conn,
            )
          : Promise.resolve([]),
      ]);
    // Check for duplicates
    const hasDuplicate = otherUtrPayIns.some(
      (item) => item.status === Status.DUPLICATE,
    );
    // Conditionally refresh otherBotResponsePayIns only if duplicate is found
    const updatedBotResponsePayIns =
      hasDuplicate || bankResponse.id
        ? await getPayInForTelegramResponseArrayDao({
            bank_response_id: bankResponse.id,
          })
        : otherBotResponsePayIns;

    // Handle already notified or confirmed cases
    if (
      payIn.is_notified &&
      [Status.SUCCESS, Status.BANK_MISMATCH, Status.DISPUTE].includes(
        payIn.status,
      )
    ) {
      await sendAlreadyConfirmedMessageTelegramBot(
        message.chat.id,
        content.utr,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
        otherUtrPayIns,
        payIn,
      );
      await rollback(conn);
      return;
    }

    // Handle UTR mismatch
    if (
      payIn.status === Status.PENDING &&
      payIn.user_submitted_utr !== content.utr
    ) {
      await sendUTRMismatchErrorMessageTelegram(
        message.chat?.id,
        content.utr,
        payIn.user_submitted_utr,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
      );
      await rollback(conn);
      return;
    }

    // Handle duplicate status
    if (payIn.status === Status.DUPLICATE) {
      if (hasDuplicate) {
        await sendMerchantOrderIDStatusDuplicateTelegramMessage(
          message.chat.id,
          payIn,
          content.utr,
          TELEGRAM_BOT_TOKEN,
          message.message_id,
          otherBotResponsePayIns,
        );
        await rollback(conn);
        return;
      } else {
        await sendMerchantOrderIDStatusDuplicateTelegramMessage(
          message.chat.id,
          payIn,
          content.utr,
          TELEGRAM_BOT_TOKEN,
          message.message_id,
          otherUtrPayIns,
        );
        await rollback(conn);
        return;
      }
    }
    // Determine duplicate entries
    const duplicateEntry =
      otherBankResponsePayIns.length > 1
        ? otherBankResponsePayIns
        : otherUtrPayIns.length > 0
          ? otherUtrPayIns.filter(
              (item) => item.merchant_order_id !== message.caption,
            )
          : updatedBotResponsePayIns;

    // Handle used bank response or duplicate entries
    if (bankResponse.is_used || duplicateEntry.length) {
      await sendAlreadyConfirmedMessageTelegramBot(
        message.chat.id,
        content.utr,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
        duplicateEntry,
        payIn,
      );
      await rollback(conn);
      return;
    }

    await _processPayInServiceInternal(
      {
        amount: payIn.amount,
        merchantOrderId: message.caption,
        userSubmittedUtr: content.utr,
        from_telegram: true,
        telegramMessage: message,
        telegramBotToken: TELEGRAM_BOT_TOKEN,
      },
      null,
      false,
      false,
      null,
      null,
      conn,
    );
    await commit(conn);
    committed = true;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error processing Telegram response:', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

export const processPayInByImageService = async (payload) => {
  let conn;
  let committed = false;
  try {
    const { base64Image, merchantOrderId } = payload;
    // Run OCR (external HTTP call) BEFORE acquiring a DB connection so a slow or
    // unavailable OCR service never pins a pooled writer connection or holds an
    // open transaction for its full duration.
    const content = await getImageContentFromOCr(base64Image);

    conn = await getConnection();
    await beginTransaction(conn);
    let payInData;
    payInData = await getPayInUrlService(merchantOrderId, null, conn);

    if (payInData.one_time_used === true || payInData.is_url_expires === true) {
      const result = {
        redirect_url: payInData.config?.urls?.return,
      };
      await rollback(conn);
      return { error: `This payin url is already used`, result };
    }
    const isUtrMissing =
      !content ||
      content.utr === null ||
      content.utr === undefined ||
      content.utr === '';
    if (isUtrMissing) {
      const duration = calculateDuration(payInData.created_at);
      const payIn = await updatePayInUrlDao(
        payInData.id,
        {
          status: Status.IMG_PENDING,
          amount: payload.amount,
          is_url_expires: true,
          one_time_used: true,
          user_submitted_image: payload.fileKey,
          duration,
        },
        conn,
      );
      await commit(conn);
      committed = true;
      return {
        status: 'IMG_PENDING',
        amount: payload.amount,
        merchant_order_id: merchantOrderId,
        return_url: payIn.config?.urls?.return,
      };
    }

    const result = await _processPayInServiceInternal(
      {
        ...payload,
        userSubmittedUtr: content.utr,
        amount: payInData.amount,
        user_submitted_image: payload.fileKey,
      },
      undefined,
      true,
      true,
      undefined,
      undefined,
      conn,
    );
    await commit(conn);
    committed = true;
    return result;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error processing PayIn by image:', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

export const disputeDuplicateTransactionService = async (
  payload,
  company_id,
  updated_by,
) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const { payInId, merchantOrderId, confirmed, amount } = payload;
    const payIn = await getPayInForDisputeServiceDao(
      {
        id: payInId,
      },
      conn,
      true // for update
    );

    if (!payIn) {
      throw new BadRequestError('Invalid PayIn');
    }

    let makeItSuccess = true,
      bankId = payIn.bank_acc_id,
      updateBalance = true,
      isMismatch = false;

      const finalStatuses = [
        Status.SUCCESS,
        Status.FAILED,
        Status.BANK_MISMATCH,
      ];
      
      if (finalStatuses.includes(payIn.status)) {
        logger.info(
          `PayIn ${payIn.id} already processed with status ${payIn.status}`
        );
        return payIn;
      }

    if (payIn.status !== Status.DISPUTE) {
      throw new BadRequestError('PayIn Status is not DISPUTE');
    }

    if (!payIn.bank_response_id) {
      throw new NotFoundError('Bank Response not found!');
    }

    const bankResponse = await getBankResponseDao({
      id: payIn.bank_response_id,
      // is_used: true,
      company_id,
    });
    const merchants = await getMerchantsDao(
      {
        id: payIn.merchant_id,
        company_id,
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      conn,
    );
    const merchant = merchants[0];
    const banks = await getBankaccountDao(
      { id: bankId, company_id },
      null,
      null,
      null,
      null,
      conn,
    );
    const bank = banks[0];

    if (!bank) {
      throw new NotFoundError('Bank not found!');
    }

    const vendors = await getVendorsDao(
      {
        user_id: bank.user_id,
        company_id,
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      conn,
    );
    const vendor = vendors[0];

    if (!merchant) {
      throw new NotFoundError('Merchant Not Found!');
    }

    const toAmount = confirmed || amount;
    const payinCommission = calculateCommission(
      toAmount,
      merchant.payin_commission,
    );
    const vendorPayinCommission = calculateCommission(
      toAmount,
      vendor.payin_commission,
    );

    if (merchantOrderId) {
      var payInData = await getPayInForDisputeServiceDao(
        {
          merchant_order_id: merchantOrderId,
        },
        conn,
        true, // for update
      );  
      if (!payInData) {
        throw new NotFoundError('PayIn not found against merchant order id');
      }

      if (payInData.merchant_id !== payIn.merchant_id) {
        throw new BadRequestError('Please provide valid merchant order id');
      }

      if (
        ![Status.ASSIGNED, Status.DROPPED, Status.DUPLICATE].includes(
          payInData.status,
        )
      ) {
        throw new BadRequestError(
          `PayIn Status: ${payInData.status} is not Accepted`,
        );
      }

      if (payInData.status === Status.DUPLICATE) {
        if (payIn.user_submitted_utr != payInData.user_submitted_utr) {
          throw new BadRequestError(
            `UTR ${payIn.user_submitted_utr} MisMatches with ${payInData.user_submitted_utr} User Submitted UTR `,
          );
        }
      }
      if (
        payIn.user_submitted_utr &&
        payIn.user_submitted_utr != bankResponse.utr
      ) {
        throw new BadRequestError(
          `UTR ${payIn.user_submitted_utr} MisMatches with ${bankResponse.utr} User Submitted UTR `,
        );
      }

      if (merchantOrderId !== payIn.merchant_order_id) {
        makeItSuccess = false;
      }
    }
    const duration = calculateDuration(payIn.created_at);
    let response = {};
    let newEntryResponse = {};
    if (!makeItSuccess) {
      const newStatus =
        payInData.bank_acc_id != bankResponse.bank_id
          ? Status.BANK_MISMATCH
          : parseFloat(payInData.amount) != parseFloat(toAmount)
            ? Status.DISPUTE
            : Status.SUCCESS;
      // make new pay in success
      if (newStatus === Status.SUCCESS) {
        // Handle sub-vendor and parent commission logic
        // let totalVendorCommission = vendorPayinCommission;
        // let brokerageCommission = 0;
        // let parentCommission = 0;
        // let payinConfig = {};

        // const subVendorParentInfo = await getSubVendorParentInfo(vendor);
        // if (subVendorParentInfo) {
        //   // Calculate parent commission
        //   // parentCommission = await updateParentVendorCalculation(
        //   //   subVendorParentInfo.parentUserId,
        //   //   Number(toAmount),
        //   //   Number(subVendorParentInfo.parentVendor.payin_commission),
        //   //   null, // No transaction connection for this path
        //   // );

        //   totalVendorCommission = vendorPayinCommission + parentCommission;
        //   brokerageCommission = parentCommission;

        //   payinConfig = {
        //     ...payIn.config,
        //     actual_vendor_commission: vendorPayinCommission,
        //     brokerage_commission: brokerageCommission,
        //   };

        //   logger.info(
        //     `Sub-vendor commission calculated for new entry: sub=${vendorPayinCommission}, parent=${parentCommission}, total=${totalVendorCommission}`,
        //   );
        // } else {
        //   payinConfig = {
        //     ...payIn.config,
        //     actual_vendor_commission: vendorPayinCommission,
        //   };
        // }

        newEntryResponse = await updatePayInUrlDao(
          payInData.id,
          {
            is_url_expires: true,
            one_time_used: true,
            is_notified: true,
            duration,
            status: newStatus,
            approved_at: new Date(),
            payin_merchant_commission: payinCommission,
            payin_vendor_commission: vendorPayinCommission,
            bank_response_id: payIn.bank_response_id,
            updated_by,
            // config: payinConfig,
          },
          conn,
        );
        await updateCalculationTable(
          merchant.user_id,
          {
            payinCommission,
            amount: toAmount,
          },
          conn,
        );
      } else {
        newEntryResponse = await updatePayInUrlDao(
          payInData.id,
          {
            is_url_expires: true,
            one_time_used: true,
            is_notified: true,
            duration,
            status: newStatus,
            bank_response_id: payIn.bank_response_id,
            updated_by,
          },
          conn,
        );
      }

      if ([Status.BANK_MISMATCH, Status.SUCCESS].includes(newStatus)) {
        bankId = payInData.bank_acc_id;
        isMismatch = true;
        await newTableEntry(tableName.PAYIN, {
          id: payInData.id,
          ...newEntryResponse,
          bank_res_details: {
            utr: bankResponse.utr || null,
            amount: bankResponse.amount || 0,
          },
          upi_id: payInData.config?.assigned_bank?.upi_id || null,
        });
        await newTableEntry(tableName.BANK_RESPONSE, {
          id: payInData.bank_response_id,
          ...bankResponse,
          is_used: true,
        });
      } else {
        updateBalance = false;
      }

      // This is async function but it's just the callback sending function there fore we are not using await
      merchantPayinCallback(payIn.config?.urls?.notify, {
        status: newStatus,
        merchantOrderId: merchantOrderId,
        payinId: payInData.id,
        amount: toAmount,
        ...merchant.config?.apiVersion === 'v2' ? {
          reqAmount: newStatus === Status.SUCCESS ? toAmount : payInData.amount,
          utrId: bankResponse.utr,
        } : {
          req_amount: newStatus === Status.SUCCESS ? toAmount : payInData.amount,
          utr_id: bankResponse.utr,
        }
      }, merchant.config?.keys?.private || null);
    }

    const updatePayload = {
      is_url_expires: true,
      one_time_used: true,
      is_notified: true,
      duration,
      updated_by,
    };

    if (makeItSuccess) {
      // Handle sub-vendor and parent commission logic
      // let totalVendorCommission = vendorPayinCommission;
      // let brokerageCommission = 0;
      // let parentCommission = 0;
      // let payinConfig = {};

      // const subVendorParentInfo = await getSubVendorParentInfo(vendor);
      // if (subVendorParentInfo) {
      //   // Calculate parent commission
      //   // parentCommission = await updateParentVendorCalculation(
      //   //   subVendorParentInfo.parentUserId,
      //   //   Number(toAmount),
      //   //   Number(subVendorParentInfo.parentVendor.payin_commission),
      //   //   null, // No transaction connection for this path
      //   // );

      //   totalVendorCommission = vendorPayinCommission + parentCommission;
      //   brokerageCommission = parentCommission;

      //   payinConfig = {
      //     ...payIn.config,
      //     actual_vendor_commission: vendorPayinCommission,
      //     brokerage_commission: brokerageCommission,
      //   };

      //   logger.info(
      //     `Sub-vendor commission calculated for makeItSuccess: sub=${vendorPayinCommission}, parent=${parentCommission}, total=${totalVendorCommission}`,
      //   );
      // } else {
      //   payinConfig = {
      //     ...payIn.config,
      //     actual_vendor_commission: vendorPayinCommission,
      //   };
      // }

      updatePayload.status = Status.SUCCESS;
      updatePayload.amount = toAmount;
      updatePayload.payin_merchant_commission = payinCommission;
      updatePayload.payin_vendor_commission = vendorPayinCommission;
      updatePayload.bank_acc_id = bankResponse.bank_id;
      updatePayload.approved_at = new Date(); //add this for approved at
      // updatePayload.config = payinConfig;
    } else {
      updatePayload.status = Status.FAILED;
    }

    response = await updatePayInUrlDao(payIn.id, updatePayload, conn);
    // await updateVendorBalanceDao(
    //   { user_id: bankResponse.user_id },
    //   toAmount,
    //   updated_by,
    //   conn,
    // );
    // This is async function but it's just the callback sending function there fore we are not using await

    merchantPayinCallback(payIn.config?.urls?.notify, {
      status: updatePayload.status,
      merchantOrderId: payIn.merchant_order_id,
      payinId: payIn.id,
      amount: toAmount,
      ...merchant.config?.apiVersion === 'v2' ? {
        reqAmount: updatePayload.status === Status.SUCCESS ? toAmount : payIn.amount,
        utrId: bankResponse.utr,
      } : {
        req_amount: updatePayload.status === Status.SUCCESS ? toAmount : payIn.amount,
        utr_id: bankResponse.utr,
      }
    }, merchant.config?.keys?.private || null);

    if (updateBalance && !isMismatch) {
      await updateMerchantBalanceDao(
        { id: payIn.merchant_id },
        toAmount,
        updated_by,
      );
      await updateCalculationTable(
        merchant.user_id,
        {
          payinCommission,
          amount: toAmount,
        },
        conn,
      );
    }
    const [company] = await getCompanyByIDDao({
      id: payIn.company_id,
    });

    await sendTelegramDisputeMessage(
      company.config?.telegramDuplicateDisputeChatId,
      payIn,
      response,
      newEntryResponse,
      bank.nick_name,
      bankResponse.utr,
      company.config?.telegramBotToken,
    );
    // Notify admins and users about payin status updates
    // const notifyPayload = {
    //   conn,
    //   payloadUserId: merchant.user_id,
    //   actorUserId: updated_by,
    //   category: 'Transaction',
    //   subCategory: 'PayIn',
    //   additionalRecipients: [vendor.user_id],
    // };

    // const notifications = [];

    // if (
    //   newEntryResponse &&
    //   typeof newEntryResponse === 'object' &&
    //   newEntryResponse.merchant_order_id !== undefined &&
    //   response?.merchant_order_id !== newEntryResponse.merchant_order_id
    // ) {
    // notifications.push(
    //   notifyAdminsAndUsers({
    //     ...notifyPayload,
    //     company_id: response.company_id,
    //     message: `Payin with merchant order id: ${response.merchant_order_id} has been Failed.`,
    //   }),
    //   notifyAdminsAndUsers({
    //     ...notifyPayload,
    //     company_id: newEntryResponse.company_id,
    //     message: `Payin with merchant order id: ${newEntryResponse.merchant_order_id} has been updated.`,
    //   }),
    // );
    // } else {
    // notifications.push(
    //   notifyAdminsAndUsers({
    //     ...notifyPayload,
    //     company_id: response.company_id,
    //     message: `Payin with merchant order id: ${response.merchant_order_id} has been updated.`,
    //   }),
    // );
    // }

    // await Promise.all(notifications);
    // Build complete socket response object
    const socketResponseObj = {
      id: payIn.id,
      sno: response.sno || payIn.sno,
      amount: response.amount || payIn.amount || 0,
      status: response.status,
      user_submitted_utr: response.user_submitted_utr || null,
      user_submitted_image: response.user_submitted_image || null,
      duration: response.duration || 0,
      nick_name: response.nick_name || '',
      bank_acc_id: response.bank_acc_id || null,
      payin_merchant_commission: response.payin_merchant_commission || 0,
      payin_vendor_commission: response.payin_vendor_commission || 0,
      merchant_details: response.merchant_details || {
        merchant_code: '',
        dispute: false,
        return_url: null,
        notify_url: null,
      },
      merchant_order_id: response.merchant_order_id || payIn.merchant_order_id,
      merchant_id: response.merchant_id || payIn.merchant_id,
      payin_details: response.payin_details || {
        urls: payIn.config?.urls || {},
        user: payIn.config?.user || {},
      },
      vendor_code: response.vendor_code || null,
      vendor_user_id: response.vendor_user_id || null,
      upi_short_code: response.upi_short_code || payIn.upi_short_code || null,
      is_url_expires: response.is_url_expires || false,
      approved_at: response.approved_at || null,
      created_by: response.created_by || null,
      updated_by: response.updated_by || null,
      is_notified: response.is_notified || false,
      upi_id: payIn.config?.assigned_bank?.upi_id || null,
      user: response.user || payIn.user || null,
      created_at: response.created_at || payIn.created_at,
      updated_at: response.updated_at || new Date().toISOString(),
      bank_res_details: response.bank_res_details || {
        utr: null,
        amount: 0,
      },
      company_id: response.company_id || payIn.company_id,
    };
    await newTableEntry(tableName.PAYIN, socketResponseObj);
    await commit(conn);
    committed = true;
    return response;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error in disputeDuplicateTransactionService:', error.message);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

export const telegramCheckUTRService = async (
  utr,
  merchant_order_id,
  company_id,
  updated_by,
  designation,
) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const bankResponse = await getBankResponsePayinDao(
      {
        utr: utr,
        status:
          designation === Role.ADMIN ? ['/freezed', '/success'] : ['/success'],
        company_id,
      },
      conn,
    );
    let otherBankResponse = {};
    const payIn = await getPayInForTelegramUtrDao(
      {
        merchant_order_id,
        company_id,
      },
      conn,
    );
    if (!bankResponse) {
      throw new NotFoundError(`UTR ${utr} not found`);
    } else if (
      (bankResponse.status !== '/success' && designation !== Role.ADMIN) ||
      (bankResponse.status !== '/success' &&
        bankResponse.status !== '/freezed' &&
        designation === Role.ADMIN)
    ) {
      throw new BadRequestError(
        `UTR ${utr} found with ${bankResponse.status} STATUS`,
      );
    } else if (!payIn) {
      throw new NotFoundError(`MerchantOrderID ${merchant_order_id} not found`);
    } else if (payIn?.user_submitted_utr && utr !== payIn?.user_submitted_utr) {
      throw new BadRequestError(
        `${utr} UTR Does Not match with ${payIn?.merchant_order_id} Merchant Order ID`,
      );
    }

    await _createCheckUtrServiceInternal(
      {
        payin_id: payIn.id,
        utr,
        company_id: company_id,
        created_by: updated_by,
        updated_by,
      },
      conn,
    );

    if (payIn.bank_response_id) {
      otherBankResponse =
        (await getBankResponseDao(
          { id: payIn.bank_response_id },
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          conn,
        )) || {};
    }

    // check old code flow
    if (payIn.status === Status.SUCCESS) {
      await rollback(conn);
      return {
        message: `${payIn.merchant_order_id} is already confirmed with ${payIn.user_submitted_utr || otherBankResponse.utr || ''}`,
      };
    }

    const isAlreadyExit = await getPayInForTelegramUtrDao(
      {
        bank_response_id: bankResponse.id,
      },
      conn,
    );
    if (isAlreadyExit && isAlreadyExit.status !== Status.FAILED) {
      await rollback(conn);
      return {
        message: `Utr: ${utr} is ${isAlreadyExit.status} with ${isAlreadyExit.merchant_order_id}`,
      };
    }
    if (isAlreadyExit && isAlreadyExit.status === Status.FAILED) {
      await updateUtrPayinService(null, isAlreadyExit.id, updated_by, utr);
    }
    if (![Status.ASSIGNED, Status.DROPPED].includes(payIn.status)) {
      await rollback(conn);
      return {
        status: payIn.status,
        message: `${payIn.merchant_order_id} is in ${payIn.status} with ${payIn.user_submitted_utr || otherBankResponse.utr || ''}`,
      };
    }
    // updatePayInUrlDao({ id: payIn.id }, { is_url_expires: false }, conn);

    const result = await _processPayInServiceInternal(
      {
        userSubmittedUtr: utr,
        merchantOrderId: merchant_order_id,
        amount: payIn.amount,
      },
      updated_by,
      false,
      false,
      designation,
      undefined,
      conn,
    );
    await commit(conn);
    committed = true;
    return result;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error in telegramCheckUTRService:', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

export const getPayinsServiceById = async (id) => {
  try {
    return await getPayinsForServiccDao({ id });
  } catch (error) {
    logger.error('Error in getPayinsServiceById:', error);
    throw error;
  }
};

export const updateUtrPayinService = async (id, user_id, utr) => {
  try {
    const updatedUtr = utr && !utr.endsWith('.') ? utr + '.' : utr;
    const payload = {
      user_submitted_utr: updatedUtr,
      bank_response_id: null,
      updated_by: user_id,
    };
    const updateUtr = await updatePayInUrlDao(id, payload);
    return updateUtr;
  } catch (error) {
    logger.error('Error in updateUtrPayinService:', error);
    throw error;
  }
};

// Helper for concurrency control
const pMap = async (list, mapper, concurrency = 5) => {
  const ret = [];
  let i = 0;
  async function next() {
    if (i >= list.length) return;
    const idx = i++;
    ret[idx] = await mapper(list[idx], idx);
    return next();
  }
  const runners = Array(Math.min(concurrency, list.length)).fill(0).map(next);
  await Promise.all(runners);
  return ret;
};

// Optimized: batch fetch, parallel process with concurrency limit
export const checkPendingPayinStatusService = async (
  user_id,
  company_id,
  user_name,
) => {
  try {
    // 1. Batch fetch all pending payins
    const payins = await getPayInPendingDao({
      company_id,
      status: Status.PENDING,
    });
    if (!payins.length) return [];

    // 2. Batch fetch all needed bank responses for all payins
    const utrList = payins.map((p) => p.user_submitted_utr).filter(Boolean);
    const bankAccIds = payins.map((p) => p.bank_acc_id).filter(Boolean);
    const merchantCodes = payins.map((p) => p.merchant).filter(Boolean);

    // Batch fetch bank responses
    const botResArr = await getBankResponsePendingBatchDao({
      is_used: false,
      status: '/success',
      utrList,
      company_id,
    });
    // Map utr -> bankResponse
    const utrToBankRes = {};
    botResArr.forEach((res) => {
      if (res && res.utr) utrToBankRes[res.utr] = res;
    });

    // Batch fetch bank accounts
    const bankAccArr = await getBankaccountDaoBatch(bankAccIds);
    const bankIdToBank = {};
    bankAccArr.forEach((bank) => {
      if (bank && bank.id) bankIdToBank[bank.id] = bank;
    });

    // Batch fetch merchants
    const merchantArr = await getMerchantsByCodesDao(merchantCodes);
    const codeToMerchant = {};
    merchantArr.forEach((merchant) => {
      if (merchant && merchant.code) codeToMerchant[merchant.code] = [merchant];
    });

    // Batch fetch vendors (by bank user_id)
    // Collect all user_ids from bank accounts
    const userIds = bankAccArr
      .map((bank) => bank && bank.user_id)
      .filter(Boolean);
    const vendorArr = await getVendorsByUserIdsDao(userIds);
    const userIdToVendor = {};
    vendorArr.forEach((vendor) => {
      if (vendor && vendor.user_id) userIdToVendor[vendor.user_id] = vendor;
    });

    // 3. Process payins in parallel (limit concurrency)
    const processedPayinIds = await pMap(
      payins,
      async (currentPayin) => {
        const botRes = utrToBankRes[currentPayin.user_submitted_utr];
        if (!botRes) return null;
        const bankResponse = botRes;
        const bankDetails = bankIdToBank[currentPayin.bank_acc_id];
        const merchantData = codeToMerchant[currentPayin.merchant];
        const vendor = bankDetails ? userIdToVendor[bankDetails.user_id] : null;
        if (!bankDetails || !merchantData || !vendor) return null;
        const payinMerchantCommission = calculateCommission(
          bankResponse.amount,
          merchantData[0].payin_commission,
        );
        const payinVendorCommission = calculateCommission(
          bankResponse.amount,
          vendor.payin_commission,
        );
        const duration = calculateDuration(currentPayin.created_at);

        let conn;
        let committed = false;
        try {
          conn = await getConnection();
          await beginTransaction(conn);
          // Check for bank ID mismatch
          if (bankDetails.id !== bankResponse.bank_id) {
            const payInData = {
              status: Status.BANK_MISMATCH,
              is_notified: true,
              user_submitted_utr: bankResponse.utr,
              bank_response_id: bankResponse.id,
              duration,
              updated_by: user_id,
            };
            const updatePayInDataRes = await updatePayInUrlDao(
              currentPayin.id,
              payInData,
              conn,
            );
            await updateBotResponseDao(
              bankResponse.id,
              {
                is_used: true,
                updated_by: user_name,
              },
              conn,
            );
            if (updatePayInDataRes) {
              merchantPayinCallback(updatePayInDataRes.config.urls?.notify, {
                status: updatePayInDataRes.status,
                merchantOrderId: updatePayInDataRes.merchant_order_id,
                payinId: updatePayInDataRes.id,
                amount: bankResponse.amount,
                ...merchantData[0].config?.apiVersion === 'v2' ? {
                  reqAmount: updatePayInDataRes.amount,
                  utrId: updatePayInDataRes.utr,
                } : {
                  req_amount: updatePayInDataRes.amount,
                  utr_id: updatePayInDataRes.utr,
                }
              }, merchantData[0]?.config?.keys?.private || null);
            }
            await commit(conn);
            committed = true;
            logger.warn(`Bank mismatch for payin ${currentPayin.id}:`, {
              payin_bank_id: currentPayin.bank_acc_id,
              bank_response_bank_id: bankResponse.bank_id,
            });
            return currentPayin.id;
          }
          // Check for amount mismatch
          else if (currentPayin.amount !== bankResponse.amount) {
            const payInData = {
              status: Status.DISPUTE,
              is_notified: true,
              user_submitted_utr: bankResponse.utr,
              bank_response_id: bankResponse.id,
              payin_merchant_commission: payinMerchantCommission,
              payin_vendor_commission: payinVendorCommission,
              duration,
              updated_by: user_id,
            };
            const updatePayInDataRes = await updatePayInUrlDao(
              currentPayin.id,
              payInData,
              conn,
            );
            await updateBotResponseDao(
              bankResponse.id,
              {
                is_used: true,
                updated_by: user_name,
              },
              conn,
            );
            if (updatePayInDataRes) {
              merchantPayinCallback(updatePayInDataRes.config.urls?.notify, {
                status: updatePayInDataRes.status,
                merchantOrderId: updatePayInDataRes.merchant_order_id,
                payinId: updatePayInDataRes.id,
                amount: bankResponse.amount,
                ...merchantData[0].config?.apiVersion === 'v2' ? {
                  reqAmount: updatePayInDataRes.amount,
                  utrId: updatePayInDataRes.utr,
                } : {
                  req_amount: updatePayInDataRes.amount,
                  utr_id: updatePayInDataRes.utr,
                }
              }, merchantData[0]?.config?.keys?.private || null);
            }
            await commit(conn);
            committed = true;
            logger.warn(`Amount dispute for payin ${currentPayin.id}:`, {
              payin_amount: currentPayin.amount,
              bank_response_amount: bankResponse.amount,
            });
            return currentPayin.id;
          }
          // If checks pass, update with provided payload and mark as valid
          else {
            const payInData = {
              status: Status.SUCCESS,
              is_notified: true,
              user_submitted_utr: botRes.utr,
              approved_at: new Date(),
              duration,
              payin_merchant_commission: payinMerchantCommission,
              payin_vendor_commission: payinVendorCommission,
              bank_response_id: botRes.id,
              updated_by: user_id,
            };
            const updatePayInDataRes = await updatePayInUrlDao(
              currentPayin.id,
              payInData,
              conn,
            );
            await updateBotResponseDao(
              bankResponse.id,
              {
                is_used: true,
                updated_by: user_name,
              },
              conn,
            );
            await updateCalculationTable(
              merchantData[0].user_id,
              {
                amount: bankResponse.amount,
                payinCommission: payinMerchantCommission,
              },
              conn,
            );
            merchantPayinCallback(updatePayInDataRes.config.urls?.notify, {
              status: updatePayInDataRes.status,
              merchantOrderId: updatePayInDataRes.merchant_order_id,
              payinId: updatePayInDataRes.id,
              amount: bankResponse.amount,
              ...merchantData[0].config?.apiVersion === 'v2' ? {
                reqAmount: updatePayInDataRes.amount,
                utrId: updatePayInDataRes.utr,
              } : {
                req_amount: updatePayInDataRes.amount,
                utr_id: updatePayInDataRes.utr,
              }
            }, merchantData[0]?.config?.keys?.private || null);
            await commit(conn);
            committed = true;
            logger.log(`Valid match found for payin ${currentPayin.id}`);
            return currentPayin.id;
          }
        } catch (error) {
          if (conn && !committed) await rollback(conn);
          logger.error(
            'Error in checkPendingPayinStatusService (payin loop):',
            error,
          );
          return null;
        } finally {
          if (conn) conn.release();
        }
      },
      5,
    ); // concurrency limit 5

    // Filter out nulls (failed/unprocessed)
    return processedPayinIds.filter(Boolean);
  } catch (error) {
    logger.error('Error in checkPendingPayinStatusService:', error);
    throw error;
  }
};

const _verifyPayinsServiceInternal = async (
  merchantOrderId,
  user_location,
  oneTimeUsed,
  payInUrl = null,
) => {
  try {
    const payIn = await getPayInUrlService(
      merchantOrderId,
      null,
      null,
      payInUrl,
    );

    if (!payIn) {
      throw new BadRequestError('Invalid merchant order id');
    }
    let role = null;
    if (payIn?.created_by) {
      const [userData] = await getUserDao({ id: payIn.created_by });
      role = userData?.role;
    }

    if (
      usedTokens.has(merchantOrderId) ||
      payIn.one_time_used === true ||
      oneTimeUsed === 'true'
    ) {
      // Update config and one_time_used in a single DB call
      const updatedConfig = stringifyJSON({
        ...payIn.config,
        user: user_location,
        page_reload: true,
      });

      await updatePayInUrlDao(payIn.id, {
        config: updatedConfig,
        one_time_used: true,
      });

      const result = {
        redirect_url: payIn.config?.urls?.return,
      };

      const merchantArr = await getValidatePayinMerchantFromCacheOrDb(
        payIn.merchant_id,
      );
      const merchant = merchantArr[0] || {};

      let bankAccountDetails = [];
      let vendorData = [];
      if (payIn.bank_acc_id) {
        bankAccountDetails = await getValidatePayinBankAccountFromCacheOrDb(
          payIn.bank_acc_id,
        );
        vendorData = await getValidatePayinVendorFromCacheOrDb(
          bankAccountDetails[0]?.user_id,
        );
      }

      const responseObj = {
        id: payIn.id,
        sno: payIn.sno,
        amount: payIn.amount || 0,
        status: payIn.bank_acc_id ? Status.DROPPED : Status.FAILED,
        user_submitted_utr: payIn.user_submitted_utr || null,
        user_submitted_image: payIn.user_submitted_image || null,
        duration: payIn.duration || 0,
        nick_name: payIn.bank_acc_id
          ? bankAccountDetails[0]?.nick_name || ''
          : '',
        bank_acc_id: payIn.bank_acc_id || null,
        merchant_order_id: payIn.merchant_order_id,
        company_id: payIn.company_id,
        vendor_code: payIn.bank_acc_id ? vendorData[0]?.code || '' : '',
        vendor_user_id: payIn.bank_acc_id
          ? vendorData[0]?.user_id || null
          : null,
        merchant_details: {
          merchant_code: merchant.code || '',
          dispute: payIn.status === Status.DISPUTE,
          return_url: payIn.config?.urls?.return || null,
          notify_url: payIn.config?.urls?.notify || null,
        },
      };

      await newTableEntry(tableName.PAYIN, responseObj);

      return { error: `This payin url is already used`, result };
    }

    const updatedConfig = stringifyJSON({
      ...payIn.config,
      user: user_location,
    });

    const updateResult = await updatePayInUrlDao(payIn.id, {
      config: updatedConfig,
      one_time_used: oneTimeUsed || false,
    });
    if (!updateResult) {
      throw new InternalServerError('Failed to update payin URL');
    }

    if (oneTimeUsed === 'true' && updateResult.one_time_used) {
      // If already used
      const result = {
        redirect_url: payIn.config?.urls?.return,
      };
      return { error: `This payin url is already used`, result };
    }

    // Atomically claim the URL, PostgreSQL guarantees only one concurrent
    // caller whose WHERE one_time_used=false matches will win, the rest get null back without any locking or transaction required.
    // const claimed = await atomicClaimPayInUrlDao(payIn.id, updatedConfig);
    // if (!claimed) {
    //   const result = { redirect_url: payIn.config?.urls?.return };
    //   return { error: `This payin url is already used`, result };
    // }

    const merchantArr = await getValidatePayinMerchantFromCacheOrDb(
      payIn.merchant_id,
    );
    const merchant = merchantArr[0] || {};
    let banks = [];
    if (payIn.bank_acc_id) {
      banks = await getMerchantLinkBankDao({
        id: payIn.bank_acc_id,
      });
    } else {
      banks = await getMerchantLinkBankDao({
        config_merchants_contains: merchant.id,
        company_id: merchant.company_id,
        is_obsolete: false,
      });
    }
    const VALID_INTENTS = new Set([
      'allow_freechips',
      'allow_cashfree',
      'allow_zentechind',
      'allow_nmplpay',
      'allow_runsafe',
      'allow_silkpay',
      'allow_razorpay',
      'allow_orvixpay',
      'allow_orvixpay1',
      'allow_albecollect',
      'allow_vertexpay',
      'allow_payeasy',
      'allow_payeasy02',
      'allow_payeasy03',
      'allow_cps',
      'allow_tytl',
      'allow_pennypay',
      'allow_trustpay',
      'allow_paybitra',
      'allow_paycric',
    ]);
    const enabledBanks = banks.filter((bank) => {
      const isPayInBank = ['PayIn', 'payIn'].includes(bank.bank_used_for);
      const isActive = bank.is_enabled && isPayInBank;
      const hasAnyMethod =
        bank.is_qr ||
        bank.is_bank ||
        bank.config?.is_phonepay ||
        bank.config?.is_intent;
      return isActive && hasAnyMethod;
    });
    const bankIntents = enabledBanks
      .map((b) => b.config?.is_intent)
      .filter((i) => VALID_INTENTS.has(String(i)));

    const merchantIntent = merchant?.config?.allow_intent;
    let cashfreeDetails = null;
    let selectedIntent = null;
    let paytmdetails = null;
    if (merchantIntent && bankIntents.length > 0) {
      cashfreeDetails = await getCashfreeAllowByCompanyIdDao(merchant.company_id);
      const allowedIntents = bankIntents.filter(
        (intent) => cashfreeDetails?.[intent] === true,
      );
      if (allowedIntents.length > 0) {
        selectedIntent =
          allowedIntents[Math.floor(Math.random() * allowedIntents.length)];
      }
    }
    else {
   paytmdetails = await getCashfreeAllowByCompanyIdDao(payIn.company_id);
    }
    const result = {
      expiryTime: payIn.expiration_date,
      amount: payIn.amount,
      one_time_used: payIn.one_time_used,
      allowCashfree:
        (selectedIntent === 'allow_cashfree' &&
          cashfreeDetails?.allow_cashfree) ||
        false,
      allowZenTechInd:
        (selectedIntent === 'allow_zentechind' &&
          cashfreeDetails?.allow_zentechind) ||
        false,
      allowNmplPay:
        (selectedIntent === 'allow_nmplpay' &&
          cashfreeDetails?.allow_nmplpay) ||
        false,
      allowrunsafe:
        (selectedIntent === 'allow_runsafe' &&
          cashfreeDetails?.allow_runsafe) ||
        false,
      allowFreechips:
        (selectedIntent === 'allow_freechips' &&
          cashfreeDetails?.allow_freechips) ||
        false,
      allowSilkPay:
        (selectedIntent === 'allow_silkpay' &&
          cashfreeDetails?.allow_silkpay) ||
        false,
      allowRazorPay:
        (selectedIntent === 'allow_razorpay' &&
          cashfreeDetails?.allow_razorpay) ||
        false,
      allowOrvixPay:
        (selectedIntent === 'allow_orvixpay' &&
          cashfreeDetails?.allow_orvixpay) ||
        false,
      allowOrvixPay1:
        (selectedIntent === 'allow_orvixpay1' &&
          cashfreeDetails?.allow_orvixpay1) ||
        false,
      allowAlbeCollect:
        (selectedIntent === 'allow_albecollect' &&
          cashfreeDetails?.allow_albecollect) ||
        false,
      allowVertexPay:
        (selectedIntent === 'allow_vertexpay' &&
          cashfreeDetails?.allow_vertexpay) ||
        false,
      allowPayeasy:
        (selectedIntent === 'allow_payeasy' &&
          cashfreeDetails?.allow_payeasy) ||
        false,
      allowPayeasy02:
        (selectedIntent === 'allow_payeasy02' &&
          cashfreeDetails?.allow_payeasy02) ||
        false,
      allowPayeasy03:
        (selectedIntent === 'allow_payeasy03' &&
          cashfreeDetails?.allow_payeasy03) ||
        false,
      allowPennyPay:
        (selectedIntent === 'allow_pennypay' &&
          cashfreeDetails?.allow_pennypay) ||
        false,
      allowTrustPay:
        (selectedIntent === 'allow_trustpay' &&
          cashfreeDetails?.allow_trustpay) ||
        false,
      allowPayBitra:
        (selectedIntent === 'allow_paybitra' &&
          cashfreeDetails?.allow_paybitra) ||
        false,
      allowPayCric:
        (selectedIntent === 'allow_paycric' &&
          cashfreeDetails?.allow_paycric) ||
        false,
      allowCpsPay:
        (selectedIntent === 'allow_cps' && cashfreeDetails?.allow_cps) || false,
      allowTytl:
        (selectedIntent === 'allow_tytl' &&
          cashfreeDetails?.allow_tytl) ||
        false,
      status: payIn.status,
      min_amount: merchant.min_payin,
      max_amount: merchant.max_payin,
      is_qr: enabledBanks.some((bank) => bank.is_qr),
      is_phonepay: enabledBanks.some((bank) => bank.config?.is_phonepay),
      is_bank: enabledBanks.some((bank) => bank.is_bank),
      redirect_url: payIn.config?.urls?.return,
      isAdmin: role === Role.ADMIN ? true : false,
      is_paytm:paytmdetails?.is_paytm_enabled || false,
      short_code: paytmdetails?.is_paytm_enabled ? payIn?.upi_short_code : null,
    };
    const response = {
      ...result,
      merchantOrderId,
    };
    usedTokens.add(merchantOrderId);
    logger.info('PayIn URL verified successfully:', response);
    return result;
  } catch (error) {
    logger.error('error in _verifyPayinsServiceInternal', error);
    throw error;
  }
};

// No transaction needed here for two reasons:
// 1. Race-condition safety is handled atomically at the DB level via atomicClaimPayInUrlDao (UPDATE ... WHERE one_time_used=false RETURNING *).
//    PostgreSQL's row-level locking ensures exactly one concurrent caller wins the claim — no BEGIN/COMMIT wrapper is required.
// 2. All other reads (merchant, bank, vendor) are independent reference-data. lookups that don't need to be consistent with each other or with the payin write
export const verifyPayinsService = async (
  merchantOrderId,
  user_location,
  oneTimeUsed,
  payInUrl = null,
) => {
  try {
    return await _verifyPayinsServiceInternal(
      merchantOrderId,
      user_location,
      oneTimeUsed,
      payInUrl,
    );
  } catch (error) {
    logger.error('Error in verifyPayinsService:', error);
    throw error;
  }
};

// function generateTransactionId() {
//   const uuid =
//     typeof randomUUID === 'function'
//       ? randomUUID()
//       : Date.now().toString(16) + Math.random().toString(16).slice(2);
//   return `IND${uuid.replace(/-/g, '').slice(0, 13)}`; // make sure total fits 32 chars with IND prefix
// }

/**
 * Validate VPA (simple RFC-like), allow common characters and domain part alphabetic
 */
// function validateVpa(vpa) {
//   if (typeof vpa !== 'string') return false;
//   const vpaRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
//   return vpaRegex.test(vpa.trim());
// }

/**
 * Safe formatter for amount: returns string with 2 decimals
 */
// function formatAmount(amount) {
//   const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
//   if (Number.isNaN(num) || !isFinite(num) || num <= 0) return null;
//   // toFixed returns string; ensure rounding to two decimals
//   return num.toFixed(2);
// }

/**
 * Convert params object to URL-encoded query (keeps null/empty as empty string)
 * Uses encodeURIComponent for values so we can include spaces, etc.
 */
// function buildQuery(paramsObj) {
//   const p = [];
//   Object.entries(paramsObj).forEach(([k, v]) => {
//     if (v === undefined) return;
//     // do not encode `pa` field
//     const val = v === null ? '' : String(v);
//     if (k === 'pa') {
//       p.push(`${k}=${val}`);
//     } else {
//       p.push(`${k}=${encodeURIComponent(val)}`);
//     }
//   });
//   return p.join('&');
// }

/**
 * parse a deeplink like "pa=...&pn=...&am=...&..."
 * returns object of key -> value
 */
export function parseDeeplink(deeplink) {
  if (!deeplink || typeof deeplink !== 'string') return {};
  return deeplink.split('&').reduce((acc, pair) => {
    const [rawKey, ...rest] = pair.split('=');
    if (!rawKey) return acc;
    const key = rawKey.trim();
    const value = rest.length ? rest.join('=').trim() : '';
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

/**
 * Set or replace a param in a deeplink string. Returns new deeplink string.
 * If key exists, it will be replaced; otherwise appended.
 */
export function setDeeplinkParam(deeplink, key, value) {
  const params = parseDeeplink(deeplink);
  params[key] = value == null ? '' : String(value);
  // rebuild preserving order by simple object iteration
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * Main service: returns urls + transactionId
 * payload expected fields:
 *  - amount (number|string)
 *  - payeeVPA (string) -> pa
 *  - payeeName (string) -> pn (optional)
 *  - transactionNote (string) -> tn optional
 *  - merchantCode -> mc optional
 *  - businessName -> bn optional (not used by all apps)
 *  - mode, purpose (optional)
 */
// export const generateUpiUrlService = async (payload = {}) => {
//   try {
//     // Basic validation
//     const amountStr = formatAmount(payload.amount);
//     if (!amountStr) throw new BadRequestError('Invalid amount');

//     const pa = (payload.payeeVPA || '').trim();
//     // if (!validateVpa(pa)) throw new BadRequestError('Invalid VPA format');

//     const transactionId = generateTransactionId();

//     // Build canonical params used by all UPI schemes
//     const canonicalParams = {
//       pa, // payee VPA
//       pn: payload.payeeName?.trim() || 'Merchant', // payee name (pn)
//       am: amountStr, // amount
//       cu: 'INR', // currency
//       tr: transactionId, // transaction reference
//       tn: (payload.transactionNote || '').trim() || transactionId, // txn note (fallback to txid)
//       tid: transactionId, // terminal id / txn id
//       featuretype: 'money_transfer',
//       mc: 'VKTRAD47056927653169',
//     };

//     // optional additions
//     // if (payload.merchantCode) canonicalParams.mc = 'VKTRAD47056927653169' || payload.merchantCode;
//     if (payload.businessName) canonicalParams.bn = payload.businessName.trim();
//     if (payload.mode) canonicalParams.mode = payload.mode;
//     if (payload.purpose) canonicalParams.purpose = payload.purpose;

//     const encoded = buildQuery(canonicalParams);

//     // Compose platform-specific deep links (ap param is app package where applicable)
//     const gpayUrl = `upi://pay?${encoded}&ap=com.google.android.apps.nbu.paisa.user`;
//     const phonepeUrl = `upi://pay?${encoded}&ap=com.phonepe.app`;
//     const paytmUrl = `upi://pay?${encoded}&ap=net.one97.paytm`;
//     const genericUpiUrl = `upi://pay?${encoded}`;

//     return {
//       gpayUrl,
//       phonepeUrl,
//       paytmUrl,
//       genericUpiUrl,
//       transactionId,
//       rawParams: canonicalParams, // useful for logging / debugging
//     };
//   } catch (error) {
//     logger.error('Error in generateUpiUrlService:', error);
//     throw error;
//   }
// };

export const generateTxnId = () => {
  const randomNumber = Math.floor(100000000 + Math.random() * 900000000);
  return `TXN${randomNumber}`;
};

export const generateUpiUrlService = async (payload = {}) => {
  if (!payload?.amount) {
    throw new BadRequestError('Missing required fields: amount, name');
  }
  const orderId = payload.orderId || generateTxnId();
  const PaytmbankName = 'AKASH TOURS AND TRAVELS';
  // const GPAYbankName = 'Pratik Hire';
  const PAYTM_MERCHANT_UPI = 'akashtravels6326@iob';
  const MERCHANT_UPI = '7208647020@ptaxis';
  const GPAY_MERCHANT_UPI = 'akashtravels6326@iob';

  try {
    const encodedName = encodeURIComponent(PaytmbankName);
    const upiLink = `upi://pay?pa=${GPAY_MERCHANT_UPI}&pn=${encodedName}&am=${payload.amount}&cu=INR&tr=${orderId}`;

    // ✅ Paytm
    const paytmLink = `paytmmp://cash_wallet?pa=${PAYTM_MERCHANT_UPI}&pn=${encodedName}&tr=${orderId}&am=${payload.amount}&cu=INR`;

    // ✅ Google Pay
    const gpayLink = `tez://upi/pay?pa=${GPAY_MERCHANT_UPI}&pn=${encodedName}&am=${payload.amount}&cu=INR&tr=${orderId}`;

    // ✅ PhonePe
    const phonepeLink = `phonepe://pay?pa=${MERCHANT_UPI}&pn=${encodedName}&am=${payload.amount}&cu=INR&tr=${orderId}`;

    const data = {
      upiLink,
      paytmLink,
      gpayLink,
      phonepeLink,
    };
    return data;
  } catch (error) {
    logger.error('Error in generateUpiUrlService:', error);
    throw error;
  }
};

const checkIsPayInExpired = (payIn) => {
  if (
    new Date(payIn.expiration_date).getTime() < Date.now() ||
    payIn.is_url_expires
  ) {
    // throw new BadRequestError('PayIn has been expired already!');
    return { message: `PayIn has been expired already!` };
  }

  return false;
};

export const updateCalculationTable = async (user_id, data, conn = null) => {
  try {
    if (isNaN(Number(data.amount) - Number(data.payinCommission))) {
      throw new BadRequestError('Invalid amount or commission');
    }
    if (user_id) {
      const calculationData = await getCalculationforCronDao(user_id, conn);
      if (!calculationData[0]) {
        throw new NotFoundError('Calculation not found!');
      }

      const totalAmount = Number(data.amount) - Number(data.payinCommission);
      const calculationId = calculationData[0].id;
      const response = await updateCalculationBalanceDao(
        { id: calculationId },
        {
          total_payin_count: 1,
          total_payin_amount: data.amount,
          total_payin_commission: data.payinCommission,
          current_balance: totalAmount,
          net_balance: totalAmount,
        },
        conn,
      );

      await trackVendorsNetBalance(user_id, response);
    }
  } catch (error) {
    logger.error('Error in updateCalculationTable:', error);
    throw error;
  }
};

// Helper function to check if vendor is sub-vendor and get parent info
const getSubVendorParentInfo = async (vendor) => {
  try {
    // Check if vendor designation is SUB_VENDOR
    if (
      vendor.designation_name !== Role.SUB_VENDOR &&
      vendor.designation !== Role.SUB_VENDOR
    ) {
      return null;
    }

    // Check is_owned config
    const isOwned = vendor.config?.is_owned;
    if (isOwned === true || isOwned === 'true') {
      return null;
    }

    // Get user hierarchy to find parent
    const userHierarchys = await getUserHierarchysDao({
      user_id: vendor.user_id,
    });
    const userHierarchy = userHierarchys?.[0];
    const parentId = userHierarchy?.config?.parent;

    if (!parentId) {
      logger.warn(`Sub-vendor ${vendor.user_id} has no parent in hierarchy`);
      return null;
    }

    // Get parent vendor details
    const parentVendors = await getVendorsDao({ user_id: parentId });
    if (!parentVendors || !parentVendors[0]) {
      logger.warn(`Parent vendor not found for user_id: ${parentId}`);
      return null;
    }

    return {
      parentVendor: parentVendors[0],
      parentUserId: parentId,
    };
  } catch (error) {
    logger.error('Error in getSubVendorParentInfo:', error);
    return null;
  }
};

// Helper function to calculate commission for parent vendor
// const updateParentVendorCalculation = async (
//   parentUserId,
//   amount,
//   vendorCommissionRate,
//   conn,
// ) => {
//   try {
//     // Always calculate commission on absolute amount, then apply sign based on amount direction
//     const baseCommission = calculateCommission(Number(amount), vendorCommissionRate);
//     const parentCommission = amount > 0 ? baseCommission : -baseCommission;

//     await updateCalculationTable(
//       parentUserId,
//       {
//         payinCommission: parentCommission,
//         amount: 0, // Parent vendor amount is always 0, only commission is tracked
//       },
//       conn,
//     );

//     return parentCommission;
//   } catch (error) {
//     logger.error('Error in updateParentVendorCalculation:', error);
//     throw error;
//   }
// };

const getOtherSuccessPayIns = async (
  bankResponse,
  includeSuccess = true,
  conn,
) => {
  try {
    const extraCondition = {};
    if (includeSuccess) {
      extraCondition.status = Status.SUCCESS;
    }
    let successData = await getSuccessPayInsDao(
      {
        bank_response_id: bankResponse.id,
        ...extraCondition,
      },
      conn,
    );
    if (!successData.length) {
      successData = await getSuccessPayInsDao(
        {
          user_submitted_utr: bankResponse.utr,
          ...extraCondition,
        },
        conn,
      );
    }

    return successData;
  } catch (error) {
    logger.error('Error in getOtherSuccessPayIns:', error);
    throw error;
  }
};

// Helper function to compare dates without time
const getDateWithoutTime = (date) => {
  return new Date(date)
    .toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .split('/')
    .join('-');
};

// Helper function to update calculation balances
const updateCalculationBalances = async (
  currentCalculation,
  nextCalculations,
  amountDiff,
  commission,
  count,
  conn,
) => {
  try {
    if (!currentCalculation) return;
    commission = amountDiff >= 0 ? commission : -commission;
    const updates = {
      total_payin_commission: commission,
      total_payin_amount: amountDiff,
      total_payin_count: count ? count : 0,
      current_balance: amountDiff == 0 ? commission : amountDiff - commission,
      net_balance: amountDiff == 0 ? commission : amountDiff - commission,
    };
    const todayDate = dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD');
    // Update current calculation
    const updatedCurrentCalculation = await updateCalculationBalanceDao(
      { id: currentCalculation[0].id },
      updates,
    );
    await trackVendorsNetBalance(
      currentCalculation[0].user_id,
      updatedCurrentCalculation,
    );

    if (nextCalculations.length > 0) {
      // Update subsequent calculations
      for (const calc of nextCalculations) {
        const calculationDate = dayjs(calc.created_at)
          .tz('Asia/Kolkata')
          .format('YYYY-MM-DD');
        let data = {};
        if (calculationDate === todayDate) {
          data = {
            total_adjustment_amount: amountDiff,
            total_adjustment_commission: commission,
            total_adjustment_count: 1,
          };
        }
        const updatedCalc = await updateCalculationBalanceDao(
          { id: calc.id },
          {
            net_balance: amountDiff - commission,
            ...data,
          },
          conn,
        );
        await trackVendorsNetBalance(calc.user_id, updatedCalc);
      }
    }
  } catch (error) {
    logger.error('Error updating calculation balances:', error);
    throw error;
  }
};
const updateCalculationParentBalances = async (
  currentCalculation,
  nextCalculations,
  amountDiff,
  commission,
  count,
  conn,
) => {
  try {
    if (!currentCalculation) return;
    const updates = {
      total_payin_commission: commission,
      total_payin_count: count ? count : 0,
      current_balance: -commission,
      net_balance: -commission,
    };
    const todayDate = dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD');
    // Update current calculation
    const updatedCurrentCalculation = await updateCalculationBalanceDao(
      { id: currentCalculation[0].id },
      updates,
      conn,
    );
    await trackVendorsNetBalance(
      currentCalculation[0].user_id,
      updatedCurrentCalculation,
    );
    if (nextCalculations.length > 0) {
      // Update subsequent calculations
      for (const calc of nextCalculations) {
        const calculationDate = dayjs(calc.created_at)
          .tz('Asia/Kolkata')
          .format('YYYY-MM-DD');
        let data = {};
        if (calculationDate === todayDate) {
          data = {
            total_adjustment_amount: amountDiff,
            total_adjustment_commission: commission,
            total_adjustment_count: 1,
          };
        }
        const updatedCalc = await updateCalculationBalanceDao(
          { id: calc.id },
          {
            net_balance: -commission,
            ...data,
          },
          conn,
        );
        await trackVendorsNetBalance(calc.user_id, updatedCalc);
      }
    }
  } catch (error) {
    logger.error('Error updating calculation balances:', error);
    throw error;
  }
};
export const updatePayInService = async (
  payload,
  merchant_order_id,
  user_id,
  company_id,
) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    // Fetch user_name using user_id
    let user_name = '';
    if (user_id) {
      const users = await getAllUsersDao(
        { id: user_id },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        conn,
      );
      user_name =
        users && users[0] && users[0].user_name ? users[0].user_name : '';
    }

    let bankResponseDataUtr;
    // let updatedBankAccIdData;
    // Validate payload
    if (!payload && (!payload.amount || !payload.utr || !payload.bank_acc_id)) {
      throw new BadRequestError(
        'At least one of amount, utr, or bank_acc_id must be provided',
      );
    }

    // Fetch pay-in first, then use its bank_response_id for the bank response query
    const payIn = await getPayInForUpdateDao({ merchant_order_id }, conn);
    const bankResponse = payIn
      ? await getBankResponseDao(
          { id: payIn.bank_response_id },
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          conn,
        )
      : null;

    if (!payIn) {
      throw new BadRequestError('Invalid merchant order id');
    }
    if (!bankResponse) {
      throw new NotFoundError('Bank Response not found');
    }

    let amountDiff = 0;
    let vendorCommission = 0;
    let merchantCommission = 0;
    // let totalVendorCommission = 0; // Declare at function level for scope access
    let newVendorCommission = 0;
    const [vendor, merchant] = await Promise.all([
      getVendorsDao({
        user_id: (
          await getBankaccountDao(
            { id: bankResponse.bank_id },
            undefined,
            undefined,
            undefined,
            undefined,
            conn,
          )
        )[0].user_id,
      }),
      getMerchantsDao(
        { id: payIn.merchant_id },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        conn,
      ),
    ]);

    // const merchant_user_id = merchant[0].user_id;
    // const vendor_user_id = vendor[0].user_id;
    // Handle amount updates
    if (
      payload?.amount &&
      !isNaN(payload.amount) &&
      payload.amount !== bankResponse.amount
    ) {
      amountDiff = payload.amount - bankResponse.amount;
      // Fetch bank, vendor, and merchant data concurrently
      const [bank] = await Promise.all([
        getBankaccountDao(
          { id: bankResponse.bank_id },
          undefined,
          undefined,
          undefined,
          undefined,
          conn,
        ),
      ]);

      if (!bank[0] || !vendor[0] || !merchant[0]) {
        throw new NotFoundError('Bank, vendor, or merchant not found');
      }
      // Calculate commissions
      vendorCommission = calculateCommission(
        Math.abs(payload.amount),
        vendor[0].payin_commission,
      );
      merchantCommission = calculateCommission(
        Math.abs(payload.amount),
        merchant[0].payin_commission,
      );

      // Handle sub-vendor and parent commission logic for amount updates
      // let amountTotalVendorCommission = vendorCommission;
      let parentCommission = 0;
      // let brokerageCommission = 0;
      // let payinConfig = {};

      const subVendorParentInfo = await getSubVendorParentInfo(vendor[0]);
      if (subVendorParentInfo) {
        // Calculate parent commission for amount difference
        const baseParentCommission = calculateCommission(
          Math.abs(amountDiff),
          Number(vendor[0].config?.mediator_payin_commission || 0),
        );
        parentCommission =
          amountDiff > 0 ? baseParentCommission : -baseParentCommission;

        // amountTotalVendorCommission = vendorCommission + parentCommission;
        // brokerageCommission = parentCommission;

        // Calculate new commission values for config
        // const currentActualCommission = payIn.config?.actual_vendor_commission || 0;
        // const currentBrokerageCommission = payIn.config?.brokerage_commission || 0;

        // Preserve existing config and only update commission keys
        // payinConfig = {
        //   ...payIn.config, // Preserve existing config
        //   actual_vendor_commission: currentActualCommission + vendorCommission,
        //   brokerage_commission: currentBrokerageCommission + brokerageCommission,
        // };

        // logger.info(
        //   `Amount update in payIn - Sub-vendor commission calculated: sub=${vendorCommission}, parent=${parentCommission}, total=${amountTotalVendorCommission}, amountDiff=${amountDiff}`,
        // );
        payload.payin_vendor_commission = vendorCommission;
        // payload.config = payinConfig;
        // totalVendorCommission = amountTotalVendorCommission; // Set the function-level variable
      }
      // else {
      //   // For regular vendors, update config with actual commission
      //   const currentActualCommission = payIn.config?.actual_vendor_commission || 0;
      //   payinConfig = {
      //     ...payIn.config, // Preserve existing config
      //     actual_vendor_commission: currentActualCommission + vendorCommission,
      //   };
      //   payload.config = payinConfig;
      //   // totalVendorCommission = vendorCommission; // Set the function-level variable
      // }

      // Fetch calculation data for vendor, merchant, and parent (if sub-vendor)
      let fetchPromises = [
        getAllCalculationforCronDao(vendor[0].user_id, conn),
        getAllCalculationforCronDao(merchant[0].user_id, conn),
      ];

      if (subVendorParentInfo) {
        fetchPromises.push(
          getAllCalculationforCronDao(subVendorParentInfo.parentUserId, conn),
        );
      }

      const calculationResults = await Promise.all(fetchPromises);
      const [
        vendorCalculationData,
        merchantCalculationData,
        parentCalculationData,
      ] = calculationResults;

      if (!vendorCalculationData[0] || !merchantCalculationData[0]) {
        throw new NotFoundError('Calculation data not found');
      }

      if (subVendorParentInfo && !parentCalculationData[0]) {
        throw new NotFoundError('Parent calculation data not found');
      }

      // Filter calculations by date
      const approvedDate = getDateWithoutTime(payIn.approved_at);

      const vendorCurrentCalculations = vendorCalculationData.filter(
        (calc) => approvedDate === getDateWithoutTime(calc.created_at),
      );
      const vendorCalculations = vendorCalculationData.filter(
        (calc) => approvedDate < getDateWithoutTime(calc.created_at),
      );
      const merchantCurrentCalculations = merchantCalculationData.filter(
        (calc) => approvedDate === getDateWithoutTime(calc.created_at),
      );
      const merchantCalculations = merchantCalculationData.filter(
        (calc) => approvedDate < getDateWithoutTime(calc.created_at),
      );

      if (!vendorCurrentCalculations[0] || !merchantCurrentCalculations[0]) {
        throw new NotFoundError('Matching calculation not found');
      }

      // Prepare parent calculation data if sub-vendor
      let parentCurrentCalculations = [];
      let parentCalculations = [];
      if (subVendorParentInfo && parentCalculationData) {
        parentCurrentCalculations = parentCalculationData.filter(
          (calc) => approvedDate === getDateWithoutTime(calc.created_at),
        );
        parentCalculations = parentCalculationData.filter(
          (calc) => approvedDate < getDateWithoutTime(calc.created_at),
        );

        if (!parentCurrentCalculations[0]) {
          throw new NotFoundError('Parent matching calculation not found');
        }
      }
      // Prepare all update promises
      let updatePromises = [
        updateBankResponseDao(
          { id: bankResponse.id, company_id: company_id },
          {
            amount: payload.amount,
            updated_by: user_name,
            config: {
              previousAmount: bankResponse.amount,
              previousUpdater: bankResponse.updated_by,
            },
          },
          conn,
        ),
        updateBankaccountDao(
          { id: bankResponse.bank_id, company_id: company_id },
          {
            balance: Number(bank[0].balance) + amountDiff,
            today_balance: Number(bank[0].today_balance) + amountDiff,
            updated_by: user_id,
          },
          conn,
        ),
        updateVendorDao(
          { id: vendor[0].user_id, company_id: company_id },
          {
            balance: Number(vendor[0].balance) + amountDiff,
            updated_by: user_id,
          },
          conn,
        ),
        updateCalculationBalances(
          vendorCurrentCalculations,
          vendorCalculations,
          amountDiff,
          calculateCommission(Math.abs(amountDiff), vendor[0].payin_commission),
          undefined,
          conn,
        ),
        updateCalculationBalances(
          merchantCurrentCalculations,
          merchantCalculations,
          amountDiff,
          calculateCommission(
            Math.abs(amountDiff),
            merchant[0].payin_commission,
          ),
          undefined,
          conn,
        ),
      ];
      // Add parent calculation updates if sub-vendor
      if (subVendorParentInfo && parentCurrentCalculations.length > 0) {
        updatePromises.push(
          updateCalculationParentBalances(
            parentCurrentCalculations,
            parentCalculations,
            amountDiff, // Parent vendor amount is always 0 for adjustments
            parentCommission,
            undefined,
            conn,
          ),
        );
      }

      // Batch all updates in a single transaction
      await Promise.all(updatePromises);
    }
    // Handle UTR updates
    else if (payload?.utr) {
      const bot = await getBankResponseDao(
        { utr: payload?.utr, company_id },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        conn,
      );
      if (bot) {
        logger.error(`Bank response found: ${payload?.utr}`);
        throw new NotFoundError(
          'This UTR has already been used. Please provide a new one.',
        );
      }
      bankResponseDataUtr = await updateBankResponseDao(
        { id: bankResponse.id, company_id: company_id },
        { utr: payload.utr, updated_by: user_name },
        conn,
      );
    }
    // Handle bank account ID updates
    else if (payload?.bank_acc_id) {
      const [prevBank, newBank] = await Promise.all([
        getBankaccountDao(
          { id: bankResponse.bank_id },
          undefined,
          undefined,
          undefined,
          undefined,
          conn,
        ),
        getBankaccountDao(
          { id: payload.bank_acc_id },
          undefined,
          undefined,
          undefined,
          undefined,
          conn,
        ),
      ]);

      if (!prevBank[0] || !newBank[0]) {
        throw new NotFoundError('Bank account not found');
      }

      if (newBank[0].id === prevBank[0].id) {
        throw new BadRequestError('Please provide a different bank account ID');
      }
      if (newBank[0].user_id !== prevBank[0].user_id) {
        const [prevVendor, newVendor] = await Promise.all([
          getVendorsDao(
            { user_id: prevBank[0].user_id },
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            conn,
          ),
          getVendorsDao(
            { user_id: newBank[0].user_id },
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            conn,
          ),
        ]);

        if (!prevVendor[0] || !newVendor[0]) {
          throw new NotFoundError('Vendor not found');
        }

        const [prevVendorCalc, newVendorCalc] = await Promise.all([
          getAllCalculationforCronDao(prevVendor[0].user_id, conn),
          getAllCalculationforCronDao(newVendor[0].user_id, conn),
        ]);

        if (!prevVendorCalc[0] || !newVendorCalc[0]) {
          throw new NotFoundError('Calculation data not found');
        }

        const approvedDate = getDateWithoutTime(bankResponse.created_at);

        const prevVendorCurrentCalcs = prevVendorCalc.filter(
          (calc) => approvedDate === getDateWithoutTime(calc.created_at),
        );
        const newVendorCurrentCalcs = newVendorCalc.filter(
          (calc) => approvedDate === getDateWithoutTime(calc.created_at),
        );

        const prevVendorNextCurrentCalcs = prevVendorCalc.filter(
          (calc) => approvedDate < getDateWithoutTime(calc.created_at),
        );
        const newVendorNextCurrentCalcs = newVendorCalc.filter(
          (calc) => approvedDate < getDateWithoutTime(calc.created_at),
        );

        if (!prevVendorCurrentCalcs[0] || !newVendorCurrentCalcs[0]) {
          throw new NotFoundError('Matching calculation not found');
        }

        const prevVendorCommission = calculateCommission(
          Math.abs(bankResponse.amount),
          prevVendor[0].payin_commission,
        );
        newVendorCommission = calculateCommission(
          Math.abs(bankResponse.amount),
          newVendor[0].payin_commission,
        );

        // Handle sub-vendor logic for both previous and new vendors
        let totalPrevVendorCommission = prevVendorCommission;
        let totalNewVendorCommission = newVendorCommission;
        let bankChangeConfig = {};

        // Check if previous vendor is sub-vendor
        const prevSubVendorParentInfo = await getSubVendorParentInfo(
          prevVendor[0],
        );
        let prevParentCommission = 0;
        let prevParentCalculationData = null;
        let prevParentCurrentCalcs = [];
        let prevParentNextCalcs = [];

        if (prevSubVendorParentInfo) {
          prevParentCommission = calculateCommission(
            Math.abs(bankResponse.amount),
            Number(prevVendor[0].config?.mediator_payin_commission || 0),
          );
          totalPrevVendorCommission =
            prevVendorCommission + prevParentCommission;

          // Fetch parent calculation data for proper adjustment handling
          prevParentCalculationData = await getAllCalculationforCronDao(
            prevSubVendorParentInfo.parentUserId,
            conn,
          );
          if (prevParentCalculationData[0]) {
            const approvedDate = getDateWithoutTime(bankResponse.created_at);
            prevParentCurrentCalcs = prevParentCalculationData.filter(
              (calc) => approvedDate === getDateWithoutTime(calc.created_at),
            );
            prevParentNextCalcs = prevParentCalculationData.filter(
              (calc) => approvedDate < getDateWithoutTime(calc.created_at),
            );
          }

          logger.info(
            `Bank ID update in payIn - Previous vendor sub-vendor commission reversed: sub=${-prevVendorCommission}, parent=${-prevParentCommission}, total=${-totalPrevVendorCommission}`,
          );
        }

        // Check if new vendor is sub-vendor
        const newSubVendorParentInfo = await getSubVendorParentInfo(
          newVendor[0],
        );
        let newParentCommission = 0;
        let newParentCalculationData = null;
        let newParentCurrentCalcs = [];
        let newParentNextCalcs = [];

        if (newSubVendorParentInfo) {
          newParentCommission = calculateCommission(
            Math.abs(bankResponse.amount),
            Number(newVendor[0].config?.mediator_payin_commission || 0),
          );
          totalNewVendorCommission = newVendorCommission + newParentCommission;

          // Fetch parent calculation data for proper adjustment handling
          newParentCalculationData = await getAllCalculationforCronDao(
            newSubVendorParentInfo.parentUserId,
            conn,
          );
          if (newParentCalculationData[0]) {
            const approvedDate = getDateWithoutTime(bankResponse.created_at);
            newParentCurrentCalcs = newParentCalculationData.filter(
              (calc) => approvedDate === getDateWithoutTime(calc.created_at),
            );
            newParentNextCalcs = newParentCalculationData.filter(
              (calc) => approvedDate < getDateWithoutTime(calc.created_at),
            );
          }

          // Update config for new sub-vendor
          bankChangeConfig = {
            ...payIn.config, // Preserve existing config
            actual_vendor_commission: newVendorCommission,
            brokerage_commission: newParentCommission,
          };

          logger.info(
            `Bank ID update in payIn - New vendor sub-vendor commission calculated: sub=${newVendorCommission}, parent=${newParentCommission}, total=${totalNewVendorCommission}`,
          );
        } else {
          // Update config for regular vendor
          bankChangeConfig = {
            ...payIn.config, // Preserve existing config
            actual_vendor_commission: newVendorCommission,
          };
        }

        // Store the config and commission update in payload for later use
        payload.config = bankChangeConfig;
        payload.payin_vendor_commission = totalNewVendorCommission;

        // Prepare all calculation update promises
        let calculationUpdatePromises = [
          updateCalculationBalances(
            prevVendorCurrentCalcs,
            prevVendorNextCurrentCalcs,
            -bankResponse.amount,
            prevVendorCommission,
            -1,
            conn,
          ),
          updateCalculationBalances(
            newVendorCurrentCalcs,
            newVendorNextCurrentCalcs,
            bankResponse.amount,
            newVendorCommission,
            1,
            conn,
          ),
        ];

        // Add parent calculation updates for bank change scenario
        if (prevSubVendorParentInfo && prevParentCurrentCalcs.length > 0) {
          calculationUpdatePromises.push(
            updateCalculationParentBalances(
              prevParentCurrentCalcs,
              prevParentNextCalcs,
              -bankResponse.amount, // Parent vendor amount is always 0
              -prevParentCommission, // Reverse the commission
              -1,
              conn,
            ),
          );
        }

        if (newSubVendorParentInfo && newParentCurrentCalcs.length > 0) {
          calculationUpdatePromises.push(
            updateCalculationParentBalances(
              newParentCurrentCalcs,
              newParentNextCalcs,
              bankResponse.amount, // Parent vendor amount is always 0
              newParentCommission, // Add the commission
              1,
              conn,
            ),
          );
        }

        await Promise.all(calculationUpdatePromises);
      } else {
        // Same vendor, different bank - still need to update vendor calculations
        const [vendorForSameBank] = await Promise.all([
          getVendorsDao(
            { user_id: prevBank[0].user_id },
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            conn,
          ),
        ]);

        if (vendorForSameBank[0]) {
          const sameBankVendorCommission = calculateCommission(
            Number(bankResponse.amount),
            vendorForSameBank[0].payin_commission,
          );

          // Handle sub-vendor logic for same vendor bank change
          let totalSameBankVendorCommission = sameBankVendorCommission;
          let sameBankConfig = {};

          const sameBankSubVendorParentInfo = await getSubVendorParentInfo(
            vendorForSameBank[0],
          );
          if (sameBankSubVendorParentInfo) {
            const sameBankParentCommission = calculateCommission(
              Number(bankResponse.amount),
              Number(sameBankSubVendorParentInfo.parentVendor.payin_commission),
            );
            totalSameBankVendorCommission =
              sameBankVendorCommission + sameBankParentCommission;

            // Update config for sub-vendor (no calculation change needed as same vendor)
            sameBankConfig = {
              ...payIn.config, // Preserve existing config
              actual_vendor_commission: sameBankVendorCommission,
              brokerage_commission: sameBankParentCommission,
            };

            logger.info(
              `Same vendor bank change in payIn - Sub-vendor commission maintained: sub=${sameBankVendorCommission}, parent=${sameBankParentCommission}, total=${totalSameBankVendorCommission}`,
            );
          } else {
            // Update config for regular vendor
            sameBankConfig = {
              ...payIn.config, // Preserve existing config
              actual_vendor_commission: sameBankVendorCommission,
            };
          }

          // Store the config update in payload
          payload.config = sameBankConfig;
          payload.payin_vendor_commission = totalSameBankVendorCommission;
        }
      }

      // Using atomic increment/decrement to prevent race conditions on concurrent updates
      const [newBankData] = await Promise.all([
        atomicDecrementBankBalanceDao(
          { id: prevBank[0].id, company_id: company_id },
          parseFloat(bankResponse.amount),
          user_id,
          conn,
        ),
        atomicUpdateBankBalanceDao(
          { id: newBank[0].id, company_id: company_id },
          parseFloat(bankResponse.amount),
          user_id,
          conn,
        ),
        updateBankResponseDao(
          { id: bankResponse.id, company_id: company_id },
          {
            bank_id: payload.bank_acc_id,
            updated_by: user_name,
            config: {
              previousBankId: bankResponse.bank_id,
              previousUpdater: bankResponse.updated_by,
            },
          },
          conn,
        ),
      ]);
      if (!newBankData) {
        throw new NotFoundError('Bank account not found');
      }
      // updatedBankAccIdData = newBankData;
    }

    delete payload.utr;

    const bankResponseId = await getPayInForUpdateServiceDao({
      merchant_order_id,
    });
    if (!bankResponseId) {
      throw new NotFoundError('Bank Response ID not found for this pay-in');
    }
    const bankResponseData = await getBankResponseDaoById({
      id: bankResponseId.bank_response_id,
      company_id: company_id,
    });
    const payInBank = await getBankaccountDao({
      id: payIn.bank_acc_id,
      company_id: company_id,
    });
    if (!payInBank[0]) {
      throw new NotFoundError('Bank Response not found for this pay-in');
    }
    // Parse existing config and add update history
    let existingConfig = {};
    try {
      existingConfig =
        typeof payIn.config === 'string'
          ? JSON.parse(payIn.config)
          : payIn.config || {};
    } catch (e) {
      logger.error('Error parsing existing config:', e);
      existingConfig = {};
    }
    // Add update history to config
    const updateHistory = {
      updated_by: user_id,
      updated_at: new Date(),
      amount: payIn.amount,
      utr: bankResponseData?.utr,
      bank_acc_id: payInBank[0]?.id,
      nick_name: payInBank[0]?.nick_name,
      payin_vendor_commission: payIn.payin_vendor_commission,
      payin_merchant_commission: payIn.payin_merchant_commission,
    };

    // Create new config object
    const newConfig = {
      ...existingConfig,
      history: Array.isArray(existingConfig.history)
        ? [...existingConfig.history, updateHistory]
        : [updateHistory],
      urls: existingConfig.urls || {},
    };

    // Update pay-in details
    const updatedPayIn = await updatePayInUrlDao(
      payIn.id,
      {
        ...payload,
        updated_by: user_id,
        user_submitted_utr: payIn.user_submitted_utr ? payload.utr : null,
        config: payload.config || newConfig, // Use payload config if set, otherwise use newConfig
        payin_merchant_commission:
          amountDiff !== 0
            ? merchantCommission
            : payIn.payin_merchant_commission,
        payin_vendor_commission: payload.amount
          ? vendorCommission
          : payload.bank_acc_id
            ? newVendorCommission
            : payIn.payin_vendor_commission,
      },
      null,
      conn,
    );
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: payIn.company_id,
    //   message: `Payin with merchant order id: ${payIn.merchant_order_id} has been updated.`,
    //   payloadUserId: merchant_user_id,
    //   actorUserId: user_id,
    //   category: 'Transaction',
    //   subCategory: 'PayIn',
    //   additionalRecipients: [vendor_user_id],
    // });
    const updatedPayInData = {
      id: updatedPayIn.id,
      sno: updatedPayIn.sno,
      amount: updatedPayIn.amount || 0,
      status: updatedPayIn.status,
      user_submitted_utr: updatedPayIn.user_submitted_utr || null,
      user_submitted_image: updatedPayIn.user_submitted_image || null,
      duration: updatedPayIn.duration || 0,
      nick_name: payInBank[0]?.nick_name || '',
      bank_acc_id: updatedPayIn.bank_acc_id || null,
      payin_merchant_commission: updatedPayIn.payin_merchant_commission || 0,
      payin_vendor_commission: updatedPayIn.payin_vendor_commission || 0,
      merchant_details: {
        merchant_code: merchant?.code || '',
        dispute: updatedPayIn.status === Status.DISPUTE,
        return_url: updatedPayIn.config?.urls?.return || null,
        notify_url: updatedPayIn.config?.urls?.notify || null,
      },
      merchant_order_id: updatedPayIn.merchant_order_id,
      merchant_id: updatedPayIn.merchant_id,
      payin_details: {
        urls: updatedPayIn.config?.urls || {},
        user: updatedPayIn.config?.user || {},
      },
      vendor_code: vendor?.code || null,
      vendor_user_id: vendor?.user_id || null,
      upi_short_code: updatedPayIn.upi_short_code || null,
      is_url_expires: updatedPayIn.is_url_expires || false,
      approved_at: updatedPayIn.approved_at || null,
      created_by: updatedPayIn.created_by || null,
      updated_by: updatedPayIn.updated_by || null,
      is_notified: updatedPayIn.is_notified || false,
      user: updatedPayIn.user || null,
      created_at: updatedPayIn.created_at,
      updated_at: updatedPayIn.updated_at || new Date().toISOString(),
      bank_res_details: {
        utr: bankResponseDataUtr?.utr || bankResponseData?.utr || null,
        amount: updatedPayIn?.amount || 0,
      },
      company_id: company_id,
    };
    await newTableEntry(tableName.PAYIN, updatedPayInData);

    await commit(conn);
    committed = true;
    return updatedPayInData;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error(`Error in updatePayInService: ${error.message}`, {
      error,
      merchant_order_id,
      user_id,
    });
    throw error;
  } finally {
    if (conn) conn.release();
  }
};
