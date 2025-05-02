import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';

import {
  getBankResponseDao,
  createBankResponseDao,
  getBankMessageDao,
  resetBankResponseDao,
  updateBotResponseDao,
  getBankResponseDaoAll,
  updateBankResponseDao,
  getBankResponseBySearchDao,
} from './bankResponseDao.js';
import { logger } from '../../utils/logger.js';
import {
  getBankaccountDao,
  updateBankaccountDao,
} from '../bankAccounts/bankaccountDao.js';
import { getSettlementDaoforInternalTransfer } from '../settlement/settlementDao.js';
// import axios from 'axios';
import { getPayInUrlsDao, updatePayInUrlDao } from '../payIn/payInDao.js';
import {
  getMerchantsDao,
  updateMerchantDao,
} from '../merchants/merchantDao.js';
import { calculateCommission } from '../../utils/calculation.js';
import { getVendorsDao, updateVendorDao } from '../vendors/vendorDao.js';
import {
  columns,
  merchantColumns,
  Role,
  Status,
  tableName,
  vendorColumns,
} from '../../constants/index.js';
import {
  getCalculationforCronDao,
  updateCalculationBalanceDao,
} from '../calculation/calculationDao.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { filterResponse } from '../../helpers/index.js';
import { notifyNewTableEntry } from '../../utils/sockets.js';
import { updateBankaccountService } from '../bankAccounts/bankaccountServices.js';

const createBankResponseService = async (
  conn,
  payload,
  companyId,
  role,
  name,
) => {
  const filterColumns =
    role === Role.MERCHANT
      ? merchantColumns.BANK_RESPONSE
      : role === Role.VENDOR
        ? vendorColumns.BANK_RESPONSE
        : columns.BANK_RESPONSE;

  const splitData = payload.split(' ');
  const amount = parseFloat(splitData[0]);
  const upi_short_code = splitData.length > 1 ? splitData[1] : '';
  const utr = splitData[2];
  const bank_id = splitData[3];
  const from_UI = splitData[4];

  // Early validation
  const isValidAmount = amount > 1 && amount < 500000;
  if (!isValidAmount) {
    return { message: 'Invalid data received' };
  }

  // UTR validation
  const validateUTR = (utr, from_UI) => {
    if (!from_UI) return true;
    const validSeparators = [',', ';', '|'];
    const hasSeparators = validSeparators.some((sep) => utr.includes(sep));
    if (hasSeparators) {
      const utrArray = utr
        .split(/[,;|]/)
        .map((u) => u.trim())
        .filter((u) => u);
      return !utrArray.some((u) => !/^[a-zA-Z0-9]+$/.test(u));
    }
    return /^[a-zA-Z0-9]+$/.test(utr);
  };

  if (!validateUTR(utr, from_UI)) {
    return { message: 'UTRs can only contain alphanumeric characters.' };
  }

  const created_by = name || 'Bank Response';
  const updated_by = name || 'Bank Response';
  const company_id = companyId;
  const isValidAmountCode =
    upi_short_code && upi_short_code !== 'nil' && upi_short_code.length === 5;
  const acceptedStatus = [
    Status.SUCCESS,
    Status.DISPUTE,
    Status.BANK_MISMATCH,
    'FAILED',
    'DUPLICATE',
  ];

  const utrAlreadyExist = await getBankResponseDao(
    { utr, company_id },
    null,
    null,
    null,
    null,
    filterColumns,
  );

  const updatedData = {
    status: utrAlreadyExist ? '/repeated' : '/success',
    amount,
    utr,
    bank_id,
    // config: { from_UI },
    is_used: 'false',
    created_by,
    updated_by,
    company_id,
    ...(isValidAmountCode && { upi_short_code }),
  };

  if (isValidAmountCode) {
    const isAmountCodeExist = await getBankResponseDao(
      { upi_short_code, company_id },
      null,
      null,
      null,
      null,
      filterColumns,
    );
    if (isAmountCodeExist) {
      return { message: 'Amount code already exist' };
    }
  }

  const sendNotification = async (status, data) => {
    await notifyNewTableEntry(tableName.BANK_RESPONSE, status, data);
  };

  let botRes;
  const utrinternalTransfer = await getSettlementDaoforInternalTransfer(utr, [
    'INTERNAL_QR_TRANSFER',
    'INTERNAL_BANK_TRANSFER',
  ]);

  if (utrinternalTransfer) {
    updatedData.status = '/internalTransfer';
    botRes = await createBankResponseDao(conn, updatedData);
    await sendNotification(updatedData.status.replace('/', ''), {
      id: botRes.id,
      utr: botRes.utr,
      amount: botRes.amount,
      bank_id: botRes.bank_id,
      company_id: botRes.company_id,
      created_by: botRes.created_by,
    });
  } else {
    botRes = await createBankResponseDao(conn, updatedData);
    await sendNotification(updatedData.status.replace('/', ''), {
      id: botRes.id,
      utr: botRes.utr,
      amount: botRes.amount,
      bank_id: botRes.bank_id,
      company_id: botRes.company_id,
      created_by: botRes.created_by,
    });
  }

  if (updatedData.status === '/repeated') {
    return { message: `Entry with REPEATED UTR Added ${utr}` };
  }

  ////for bank account ////vendor calculation
  if (botRes.status === '/success') {
    const bankdetails = await getBankaccountDao(
      {
        id: botRes?.bank_id,
        company_id: companyId,
      },
      null,
      null,
      role,
    );
    if (isNaN(bankdetails[0].balance) || isNaN(bankdetails[0].today_balance)) {
      throw new BadRequestError('Invalid amount or commission');
    }
    await updateBankaccountDao(
      { id: botRes?.bank_id },
      {
        balance: parseFloat(bankdetails[0].balance) + parseFloat(botRes.amount),
        today_balance:
          parseFloat(bankdetails[0].today_balance) + parseFloat(botRes.amount),
        payin_count: parseFloat(bankdetails[0].payin_count + 1),
      },
      conn,
    );
    await updateBankaccountService(
      conn,
      { id: botRes?.bank_id, company_id: companyId },
      {},
    );
    const vendor = await getVendorsDao({
      user_id: bankdetails[0].user_id,
    });
    if (isNaN(vendor[0].balance)) {
      throw new BadRequestError('Invalid amount or commission');
    }
    await updateVendorDao(
      { id: vendor[0].id },
      {
        balance: parseFloat(vendor[0].balance) + parseFloat(botRes.amount),
      },
      conn,
    );
    const payinVendorCommission = calculateCommission(
      botRes.amount,
      vendor[0].payin_commission,
    );

    await updateCalculationTable(vendor[0].user_id, {
      payinCommission: payinVendorCommission,
      amount: botRes.amount,
    });
  }
  const checkPayInUtr = await getPayInUrlsDao({ user_submitted_utr: utr });
  if (checkPayInUtr?.length > 0) {
    const payInUtr = checkPayInUtr.length === 1 ? checkPayInUtr[0] : checkPayInUtr[checkPayInUtr.length - 1];
    if (upi_short_code && isValidAmountCode) {
      const getDataByUtr = await getBankResponseDaoAll(
        { utr: payInUtr.user_submitted_utr, company_id },
        null,
        null,
        null,
        null,
        filterColumns,
      );
      const botUtrIsUsed =
        getDataByUtr.rows.length > 1 &&
        getDataByUtr.some((item) => item.is_used);
      if (!acceptedStatus.includes(payInUtr.status) && botUtrIsUsed) {
        return { message: `The entry is already ${payInUtr.status} with UTR` };
      }
    }

    const isBankExist = await getBankaccountDao(
      { id: bank_id, company_id },
      null,
      null,
      role,
    );
    if (!isBankExist || payInUtr.bank_acc_id !== bank_id) {
      if (payInUtr.user_submitted_utr && payInUtr.user_submitted_utr !== utr) {
        return {
          message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${payInUtr.user_submitted_utr}`,
        };
      }
      const payInData = {
        status: Status.BANK_MISMATCH,
        is_notified: true,
        user_submitted_utr: botRes.utr,
        bank_response_id: botRes.id,
        approved_at: new Date(),
        // config: { from_UI },
      };
      const updatePayInDataRes = await updatePayInUrlDao(
        payInUtr.id,
        payInData,
        conn,
      );
      await updateBotResponseDao(botRes.id, { is_used: true }, conn);
      await sendNotification(Status.BANK_MISMATCH, {
        id: payInUtr.id,
        user_submitted_utr: botRes.utr,
        bank_response_id: botRes.id,
        merchant_order_id: updatePayInDataRes?.merchant_order_id,
      });
      return {
        message: `Bank Mismatch with ${updatePayInDataRes?.merchant_order_id}`,
      };
    }

    const existingResponse = await getBankResponseDao(
      { utr, is_used: true, company_id },
      null,
      null,
      null,
      null,
      filterColumns,
    );
    if (existingResponse?.length > 0) {
      return { message: `The UTR already exists` };
    }
    const merchantData = await getMerchantsDao(
      { id: payInUtr.merchant_id },
      null,
      null,
      null,
      null,
    );
    const payinMerchantCommission = calculateCommission(
      botRes.amount,
      merchantData[0].payin_commission,
    );
    const bankAccountDetails = await getBankaccountDao(
      { id: payInUtr.bank_acc_id, company_id },
      null,
      null,
      role,
    );
    const vendorData = await getVendorsDao(
      { user_id: bankAccountDetails[0].user_id },
      null,
      null,
      null,
      null,
    );
    const payinVendorCommission = calculateCommission(
      botRes.amount,
      vendorData[0].payin_commission,
    );
    const durMs = new Date() - payInUtr.created_at;
    const durSeconds = Math.floor((durMs / 1000) % 60)
      .toString()
      .padStart(2, '0');
    const durMinutes = Math.floor((durSeconds / 60) % 60)
      .toString()
      .padStart(2, '0');
    const durHours = Math.floor((durMinutes / 60) % 24)
      .toString()
      .padStart(2, '0');
    const duration = `${durHours}:${durMinutes}:${durSeconds}`;

    if (payInUtr.amount === amount) {
      if (payInUtr.user_submitted_utr && payInUtr.user_submitted_utr !== utr) {
        return {
          message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${payInUtr.user_submitted_utr}`,
        };
      }
      const payInData = {
        status: Status.SUCCESS,
        is_notified: true,
        user_submitted_utr: botRes.utr,
        approved_at: new Date(),
        duration,
        payin_merchant_commission: payinMerchantCommission,
        payin_vendor_commission: payinVendorCommission,
        // config: { from_UI },
        bank_response_id: botRes.id,
      };
      await updatePayInUrlDao(payInUtr.id, payInData, conn);
      // if (payInUtr.bank_acc_id) {
      //   await updateBankaccountDao(
      //     { id: payInUtr.bank_acc_id },
      //     {
      //       balance: bankAccountDetails.balance + amount,
      //       today_balance: bankAccountDetails.balance + amount,
      //     },
      //     conn
      //   );
      // }
      await updateBotResponseDao(botRes.id, { is_used: true }, conn);
      const merchnatData = merchantData[0].balance + amount;
      if (isNaN(merchnatData)) {
        throw new BadRequestError('Invalid amount or commission');
      }
      await updateMerchantDao(
        { id: payInUtr.merchant_id },
        { balance: merchnatData },
        conn,
      );
      await updateCalculationTable(merchantData[0].user_id, {
        payinCommission: payinMerchantCommission,
        amount: botRes.amount,
      });

      await sendNotification(Status.SUCCESS, {
        id: payInUtr.id,
        user_submitted_utr: botRes.utr,
        bank_response_id: botRes.id,
        merchant_id: payInUtr.merchant_id,
        amount: botRes.amount,
      });
      return { message: `Successfully Created The Entry` };
    } else {
      if (payInUtr.user_submitted_utr && payInUtr.user_submitted_utr !== utr) {
        return {
          message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${payInUtr.user_submitted_utr}`,
        };
      }
      const payInData = {
        status: Status.DISPUTE,
        is_notified: true,
        user_submitted_utr: botRes.utr,
        bank_response_id: botRes.id,
        approved_at: new Date(),
        duration,
        payin_merchant_commission: payinMerchantCommission,
        payin_vendor_commission: payinVendorCommission,
        // config: { from_UI },
      };
      const updatePayInDataRes = await updatePayInUrlDao(
        payInUtr.id,
        payInData,
        conn,
      );
      await updateBotResponseDao(botRes.id, { is_used: true }, conn);
      await sendNotification(Status.DISPUTE, {
        id: payInUtr.id,
        user_submitted_utr: botRes.utr,
        bank_response_id: botRes.id,
        merchant_order_id: updatePayInDataRes?.merchant_order_id,
      });
      return {
        message: `Entry is in Dispute with ${updatePayInDataRes?.merchant_order_id}`,
      };
    }
  }

  return { message: `Entry created successfully` };
};

const updateCalculationTable = async (user_id, data, conn) => {
  if (isNaN(data.amount - data.payinCommission)) {
    throw new BadRequestError('Invalid amount or commission');
  }
  if (user_id) {
    const calculationData = await getCalculationforCronDao(user_id);
    if (!calculationData[0]) {
      throw new NotFoundError('Calculation not found!');
    }
    // let count = calculationData[0].total_settlement_count + 1;
    // let commissionCalculation =
    //  calculationData[0].total_payin_commission + data?.payinCommission;
    // let amountCalculation =
    //   calculationData[0].total_payin_amount + data?.amount - commissionCalculation;
    // let currentBalance = Number(calculationData[0].current_balance) || 0 + data?.amount;
    // let netBalance = calculationData[0].net_balance + data?.amount;
    const calculationId = calculationData[0].id;
    const totalAmount = Number(data.amount) - Number(data.payinCommission);
    await updateCalculationBalanceDao(
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
  }
};

const getBankResponseService = async (payload, role, page, limit, search) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.BANK_RESPONSE
        : role === Role.VENDOR
          ? vendorColumns.BANK_RESPONSE
          : columns.BANK_RESPONSE;

    const sno = Number(payload.sno) > 0 ? Number(payload.sno) : undefined;
    const amount =
      Number(payload.amount) > 0 ? Number(payload.amount) : undefined;
    const is_used =
      payload.is_used === 'Used'
        ? true
        : payload.is_used === 'Unused'
          ? false
          : undefined;

    let filters = Object.fromEntries(
      Object.entries({
        sno,
        status: payload.status || undefined,
        amount,
        utr: payload.utr || undefined,
        bank_id: payload.bank_id || undefined,
        is_used,
        company_id: payload.company_id || undefined,
      }).filter(([, v]) => v !== undefined),
    );
    filters = {
      ...(search ? { search } : {}),
      ...filters,
    }
    return await getBankResponseDaoAll(filters, page, limit, 'updated_at', 'DESC', filterColumns);
  } catch (error) {
    logger.error('Error in getBankResponseService:', error);
    throw new InternalServerError(error);
  }
};

const getBankResponseBySearchService = async (
  filters,
  role,
  // designation,
  // user_id,
) => {
  try {
    const pageNum = parseInt(filters.page);
    const limitNum = parseInt(filters.limit);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }
    const searchTerms = filters.search
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);

    if (searchTerms.length === 0) {
      throw new BadRequestError('Please provide valid search terms');
    }
    const offset = (pageNum - 1) * limitNum;

    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.SETTLEMENT
        : role === Role.VENDOR
          ? vendorColumns.SETTLEMENT
          : columns.SETTLEMENT;

    const data = await getBankResponseBySearchDao(
      filters.company_id,
      searchTerms,
      limitNum,
      offset,
      filterColumns,
    );

    return data;
  } catch (error) {
    console.error('Error while fetching Payin by search', error);
    throw new InternalServerError(error.message);
  }
};
const updateBankResponseService = async (id, payload, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.BANK_RESPONSE
        : role === Role.VENDOR
          ? vendorColumns.BANK_RESPONSE
          : columns.BANK_RESPONSE;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const data = await updateBankResponseDao(id, payload, conn); // Adjust DAO call for update
    await commit(conn); // Commit the transaction
    console.log('BankResponse updated successfully', 'info');
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        console.log(
          'Error during transaction rollback',
          'error',
          rollbackError,
        );
      }
    }
    console.log('Error while updating BankResponse', 'error', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        console.log(
          'Error while releasing the connection',
          'error',
          releaseError,
        );
      }
    }
  }
};

const getBankMessageServices = async (
  bank_id,
  startDate,
  endDate,
  company_id,
  role,
  page,
  limit,
) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.BANK_RESPONSE
        : role === Role.VENDOR
          ? vendorColumns.BANK_RESPONSE
          : columns.BANK_RESPONSE;
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    return await getBankMessageDao(
      bank_id,
      startDate,
      endDate,
      company_id,
      pageNumber,
      pageSize,
      null,
      null,
      filterColumns,
    );
  } catch (error) {
    console.error('Error while getting BankResponse', 'error', error);
    throw new BadRequestError('Error occurred while getting BankResponse');
  }
};

const resetBankResponseService = async (id, userData) => {
  try {
    const data = await resetBankResponseDao(id, userData);
    logger.log('Deleted BankResponse successfully', 'info');
    return data;
  } catch (error) {
    console.error('Error while updating BankResponse', 'error', error);
    throw new BadRequestError('Error occurred while updating BankResponse');
  }
};

export {
  getBankResponseService,
  createBankResponseService,
  updateBankResponseService,
  getBankMessageServices,
  getBankResponseBySearchService,
  resetBankResponseService,
};
