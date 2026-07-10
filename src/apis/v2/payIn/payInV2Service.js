import dayjs from 'dayjs';
import { Currency, Role, Status, tableName } from '../../../constants/index.js';
import { calculateDuration } from '../../../helpers/index.js';
import { stringifyJSON } from '../../../utils//index.js';
import config from '../../../config/config.js';
import logger from '../../../utils/logger.js';
import {
  generatePayInUrlDao,
  getPayInWithBankResponseForStatusDao,
  getPayInWithMerchantOrderIdDao,
  updatePayInUrlDao,
} from '../../payIn/payInDao.js';
import {
  assignedBankToPayInUrlService,
  determineType,
} from '../../payIn/payInService.js';
import { getUserByCompanyCreatedAtDao } from '../../users/userDao.js';
import { getCachedData, setCachedData } from '../../../utils/redishashkey.js';
import { getCompanyByIDDao } from '../../company/companyDao.js';
import { getMerchantBankDao } from '../../bankAccounts/bankaccountDao.js';
import { sendBankNotAssignedAlertTelegram } from '../../../utils/sendTelegramMessages.js';
import { newTableEntry } from '../../../utils/sockets.js';
import {
  BadRequestError,
  CustomError,
  NotFoundError,
} from '../../../utils/appErrors.js';
import { nanoid } from 'nanoid';
import { v4 as uuidv4 } from 'uuid';

const PAYIN_ROUTING_CACHE_TTL_SEC =
  config?.controllerCacheTtls?.payin?.routing || 60;
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

export const generatePayInUrlV2Service = async (payload, role) => {
  try {
    const {
      merchant,
      user_id,
      merchant_order_id = uuidv4(),
      amount,
      returnUrl,
      notifyUrl,
      ot,
    } = payload;
    const code = merchant.code;

    // Kick off the duplicate-order lookup up front. It is independent of the
    // merchant routing data, so overlapping the two round-trips removes a serial
    // DB hop from the hot path. It is still EVALUATED at the same point below, so
    // error precedence (bank checks before "order already exists") is unchanged.
    // The benign catch prevents an unhandled rejection if an earlier guard
    // returns before we await the promise.
    const existingOrderPromise =
      getPayInWithMerchantOrderIdDao(merchant_order_id);
    existingOrderPromise.catch(() => {});

    // Cache merchant routing data to reduce repeated DB reads under load.
    // Merchant config and bank assignments change rarely; 60s TTL is safe.
    const routingCacheKey = `merchant_routing:${merchant.id}`;
    let company, bankAssigned;

    const cachedRouting = await getCachedData(
      routingCacheKey,
      'merchant_routing',
    );
    if (cachedRouting) {
      ({ company, bankAssigned } = cachedRouting);
    } else {
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
        { company, bankAssigned },
        PAYIN_ROUTING_CACHE_TTL_SEC,
        'merchant_routing',
      );
    }

    const type = determineType(bankAssigned);

    if (bankAssigned.length === 0) {
      await triggerBankAlert(company, code);
      throw new CustomError(
        422,
        'Bank Account has not been linked with Merchant',
      );
    }

    if (bankAssigned?.every(isBankDisabled)) {
      throw new CustomError(409, 'All Assigned Banks are Disabled!');
    }

    // all payment methods disabled
    if (bankAssigned?.every(isPaymentMethodDisabled)) {
      await triggerBankAlert(company, code);
      throw new CustomError(503, 'No Payment Methods Enabled!');
    }

    const existingOrder = await existingOrderPromise;
    if (existingOrder) {
      throw new BadRequestError('Merchant Order ID already exists');
    }

    if (amount < merchant.min_payin || amount > merchant.max_payin) {
      throw new CustomError(
        422,
        `Amount must be between ${merchant.min_payin} and ${merchant.max_payin}`,
      );
    }

    const expirationDate = dayjs()
      .add(ot === 'y' ? 10 : 30, ot === 'y' ? 'minute' : 'day')
      .toISOString();

    let admin;
    if (role === Role.ADMIN) {
      admin = await getUserByCompanyCreatedAtDao(merchant.company_id, role);
    }

    const data = {
      amount: amount || 0,
      status: Status.INITIATED,
      currency: Currency.INR,
      merchant_order_id,
      user: user_id,
      merchant_id: merchant.id,
      expiration_date: expirationDate,
      company_id: merchant.company_id,
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
    if (merchant?.config?.allow_intent) {
      const validIntentBanks = bankAssigned.filter((bank) => {
        const intent = bank?.config?.is_intent;
        return intent && intent !== 'off' && intent !== false;
      });
      if (validIntentBanks.length === 0) {
        await triggerBankAlert(company, code);
        throw new CustomError(
          422,
          'Bank account not found for the given merchant',
        );
      }
      const randomBank =
        validIntentBanks[Math.floor(Math.random() * validIntentBanks.length)];
      const duration = calculateDuration(result.created_at);
      await updatePayInUrlDao(result.id, {
        amount: Number.parseFloat(amount || 0),
        status: Status.ASSIGNED,
        bank_acc_id: randomBank.id,
        duration: duration,
      });
    }
    // Assign bank if H2H
    if (merchant.config?.is_h2h) {
      const assign = await assignedBankToPayInUrlService(
        merchant_order_id,
        amount,
        type,
      );
      const merchantConfig = {
        h2h: merchant?.config?.is_h2h || false,
      };
      result.merchant = merchantConfig;
      result.bank = assign.bank;
      result.type = type;
    }
    // await newTableEntry(tableName.PAYIN);
    return result;
  } catch (error) {
    logger.error('Error generating payin url:', error);
    throw error;
  }
};

// Public API Used by Merchants
export const checkPayInStatusV2Service = async (merchantOrderId, merchant) => {
  try {
    // Single round trip: PayIn joined with its BankResponse (if any).
    const payIn = await getPayInWithBankResponseForStatusDao(merchantOrderId);

    if (!payIn) {
      throw new NotFoundError('Order id does not exist');
    }

    //check is payIn detials belongs to that merchant or not
    if (!(payIn.merchant_id === merchant.id)) {
      throw new NotFoundError('Merchant order id does not exist');
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
        : (payIn.bank_response_amount ?? null),
      payinId: payIn.id,
      reqAmount: payIn.amount,
      utrId: [
        Status.INITIATED,
        Status.ASSIGNED,
        Status.DROPPED,
        Status.IMG_PENDING,
      ].includes(payIn.status)
        ? ' '
        : (payIn.bank_response_utr ?? payIn.user_submitted_utr),
    };
  } catch (error) {
    logger.error('Error check payin:', error);
    throw error;
  }
};
