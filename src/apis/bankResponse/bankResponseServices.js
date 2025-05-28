/* eslint-disable no-useless-escape */
import {
  BadRequestError,
  // InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';
import { merchantPayinCallback } from '../../callBacksAndWebHook/merchantCallBacks.js';
import {
  getBankResponseDao,
  createBankResponseDao,
  getBankMessageDao,
  updateBotResponseDao,
  getBankResponseDaoAll,
  updateBankResponseDao,
  getClaimResponseDao,
  getBankResponseBySearchDao,
  resetBankResponseDao,
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
  getAllCalculationforCronDao,
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
import PDFParser from 'pdf2json';

const createBankResponseService = async (
  conn,
  payload,
  companyId,
  role,
  name,
) => {
  try {
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
    const isValidAmount = amount >= 1 && amount <= 500000;
    if (!isValidAmount) {
      throw new BadRequestError(`amount must be between 1 and 500000`);
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
      const res = await updateBankaccountDao(
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
        { latest_balance: res.today_balance },
        role,
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
      // await notifyNewCalculationTableEntry(tableName.CALCULATION, vendorCalculation);
    }
    const checkPayInUtr = await getPayInUrlsDao({ user_submitted_utr: utr });
    if (checkPayInUtr?.length > 0) {
      const payInUtr =
        checkPayInUtr.length === 1
          ? checkPayInUtr[0]
          : checkPayInUtr[checkPayInUtr.length - 1];
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
        if (updatePayInDataRes) {
          merchantPayinCallback(updatePayInDataRes.config.urls?.notify, {
            status: updatePayInDataRes.status,
            merchantOrderId: updatePayInDataRes.merchant_order_id,
            payinId: updatePayInDataRes.id,
            amount: botRes.amount,
            req_amount: updatePayInDataRes.amount,
            utr_id: updatePayInDataRes.utr,
          });
        }
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
        const updatePayin = await updatePayInUrlDao(payInUtr.id, payInData, conn);
        await updateBotResponseDao(botRes.id, { is_used: true }, conn);
        merchantPayinCallback(updatePayin.config.urls?.notify, {
          status: updatePayin.status,
          merchantOrderId: updatePayin.merchant_order_id,
          payinId: updatePayin.id,
          amount: botRes.amount,
          req_amount: updatePayin.amount,
          utr_id: updatePayin.utr,
        });
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
        if (updatePayin) {
          return {
            message: `✅ UTR ${utr} matches the User Submitted UTR: ${payInUtr.user_submitted_utr} and the payment was successful.`,
          };
        }
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
        if (updatePayInDataRes) {
          merchantPayinCallback(updatePayInDataRes.config.urls?.notify, {
            status: updatePayInDataRes.status,
            merchantOrderId: updatePayInDataRes.merchant_order_id,
            payinId: updatePayInDataRes.id,
            amount: botRes.amount,
            req_amount: updatePayInDataRes.amount,
            utr_id: updatePayInDataRes.utr,
          });
        }

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
  }
    catch (error) {
      logger.error('Error in createBankResponseService:', error.message);
      throw error;
    }
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
    const calculationId = calculationData[0].id;
    const totalAmount = Number(data.amount) - Number(data.payinCommission);
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
    return response;
  }
};

const getClaimResponseService = async (payload) => {
  try {
    let filters = Object.fromEntries(
      Object.entries({
        date: payload.date || undefined,
        company_id: payload.company_id || undefined,
      }).filter(([, v]) => v !== undefined),
    );
    filters = {
      ...filters,
    };
    return await getClaimResponseDao(filters);
  } catch (error) {
    logger.error('Error in getBankResponseService:', error);
    throw error;
  }
};

const getBankResponseService = async (payload, role, page, limit, search, updated) => {
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
        //start and end date bank reponse report
      }).filter(([, v]) => v !== undefined),
    );
    filters = {
      ...(search ? { search } : {}),
      ...filters,
    };
    return await getBankResponseDaoAll(
      filters,
      page,
      limit,
      payload.sort_by || 'sno',
      'DESC',
      filterColumns,
      updated,
      payload.startDate || undefined,
      payload.endDate || undefined,
    );
  } catch (error) {
    logger.error('Error in getBankResponseService:', error);
    throw error;
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
    logger.error('Error while fetching Payin by search', error);
    throw error;
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
    logger.info('BankResponse updated successfully', 'info');
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        logger.info(
          'Error during transaction rollback',
          'error',
          rollbackError,
        );
      }
    }
    logger.info('Error while updating BankResponse', 'error', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        logger.info(
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
    logger.error('Error while getting BankResponse', 'error', error.message);
    throw error;
    ;
  }
};

const resetBankResponseService = async (conn, id, userData) => {
  const { company_id, user_name, user_id, role, amount, utr, bank_id } =
    userData;

  try {
    // Fetch bank response
    const botRes = await getBankResponseDao({ id, company_id });
    if (!botRes) {
      logger.error(`Bank response not found for ID: ${id}`);
      throw new NotFoundError('Bank response not found');
    }

    // Check for successful pay-in
    let payInData = await getPayInUrlsDao({ user_submitted_utr: botRes.utr });
    if (!payInData?.length) {
      payInData = await getPayInUrlsDao({ bank_response_id: botRes.id });
    }

    const hasSuccess = payInData?.some(
      (item) => item.status === Status.SUCCESS,
    );
    if (hasSuccess) {
      const successPayIn = payInData.find(
        (item) => item.status === Status.SUCCESS,
      );
      logger.warn(
        `UTR already confirmed for Merchant Order ID: ${successPayIn.merchant_order_id}`,
        'warn',
      );
      throw new BadRequestError(
        `UTR is already confirmed with Merchant Order ID ${successPayIn.merchant_order_id}. No changes applied. Previous Amount: ${botRes.amount}`,
      );
    }

    // Prepare base update data
    let updateData = {
      is_used: false,
      updated_by: user_name,
      config: botRes.config || {},
    };

    // Handle specific updates based on input
    let message = 'Bot response reset successful';
    if (typeof amount === 'number' && !isNaN(amount)) {
      ({ updateData, message } = await handleAmountUpdate({
        botRes,
        amount,
        user_name,
        company_id,
        role,
        payInData,
        conn,
      }));
    } else if (utr) {
      await handleUtrUpdate({ botRes, utr, user_id, user_name, conn });
    } else if (bank_id) {
      await handleBankIdUpdate({
        botRes,
        bank_id,
        company_id,
        user_id,
        user_name,
        conn,
      });
    } else {
      await updatePayInData({ payInData, user_name, botRes });
      await resetBankResponseDao(id, updateData);
    }

    logger.info(`Bank response reset successful for ID: ${id}`, 'info');

    return { message };
  } catch (error) {
    logger.error(`Error resetting bank response for ID: ${id}`, 'error', error.message);
    throw error;
  }
};

// Handle amount update
const handleAmountUpdate = async ({
  botRes,
  amount,
  user_name,
  role,
  payInData,
  conn,
}) => {
  try {
    const previousAmount = botRes.amount;
    const previousUpdater = botRes.updated_by;
    const updateData = {
      updated_by: user_name,
      config: { ...(botRes.config || {}), previousAmount, previousUpdater },
      amount,
    };

    if (amount !== previousAmount) {
      const bankDetails = await getBankaccountDao({ id: botRes.bank_id });
      if (!bankDetails[0]) throw new NotFoundError('Bank account not found');

      const bank = bankDetails[0];
      const vendor = await getVendorsDao({ user_id: bank.user_id });
      if (!vendor[0]) throw new NotFoundError('Vendor not found');

      const updatedAmount =
        botRes.amount > amount
          ? `-${Math.abs(botRes.amount - amount)}`
          : `+${Math.abs(amount - botRes.amount)}`;

      const payinCommission = calculateCommission(
        updatedAmount,
        vendor[0].payin_commission,
      );

      await Promise.all([
        updateCalculationTable(vendor[0].user_id, {
          payinCommission,
          amount: updatedAmount,
        }),
        updateBankaccountDao(
          { id: bank.id },
          {
            balance: parseFloat(bank.balance) + parseFloat(updatedAmount),
            today_balance:
              parseFloat(bank.today_balance) + parseFloat(updatedAmount),
          },
        ).then((res) =>
          updateBankaccountService(
            undefined,
            { id: bank.id, company_id: res.company_id },
            { latest_balance: res.today_balance },
            role,
          ),
        ),
        updatePayInData({ payInData, user_name, botRes }),
        updateBotResponseDao(botRes.id, updateData, conn),
      ]);
    }

    return {
      updateData,
      message: `Bot response reset successful. Previous Amount: ${previousAmount}`,
    };
  } catch (error) {
    logger.error('Error in handle bank resp. amount update:', error.message);
    throw error;
  }
};

// Handle UTR update
const handleUtrUpdate = async ({ botRes, utr, user_id, user_name, conn }) => {
  try {
    const previousUTR = botRes.utr;
    const previousUpdater = botRes.updated_by;
    const updateData = {
      utr: utr,
      updated_by: user_name,
      config: { ...(botRes.config || {}), previousUTR, previousUpdater },
    };
    const payIn = await getPayInUrlsDao({ user_submitted_utr: utr });
    if (payIn?.length && payIn[0].user_submitted_utr) {
      await updatePayInUrlDao(payIn[0].id, {
        user_submitted_utr: utr,
        updated_by: user_id,
      });
    }
    await updateBotResponseDao(botRes.id, updateData, conn);
  } catch (error) {
    logger.error('Error in handle bank utr update:', error.message);
    throw error;
  }
};

// Handle bank ID update
const handleBankIdUpdate = async ({
  botRes,
  bank_id,
  company_id,
  user_id,
  user_name,
  conn,
}) => {
  try {
    const [prevBank, newBank] = await Promise.all([
      getBankaccountDao({ id: botRes.bank_id }),
      getBankaccountDao({ id: bank_id }),
    ]);
    const previousBank = prevBank[0].nick_name;
    const previousUpdater = botRes.updated_by;
    const updateData = {
      bank_id: newBank[0].id,
      updated_by: user_name,
      config: { ...(botRes.config || {}), previousBank, previousUpdater },
    };

    if (!prevBank[0] || !newBank[0])
      throw new NotFoundError('Bank account not found');
    if (newBank[0].id === prevBank[0].id) {
      throw new BadRequestError('Please provide a different bank account ID');
    }

    const [prevVendor, newVendor] = await Promise.all([
      getVendorsDao({ user_id: prevBank[0].user_id }),
      getVendorsDao({ user_id: newBank[0].user_id }),
    ]);

    if (!prevVendor[0] || !newVendor[0])
      throw new NotFoundError('Vendor not found');

    const [prevVendorCalc, newVendorCalc] = await Promise.all([
      getAllCalculationforCronDao(prevVendor[0].user_id),
      getAllCalculationforCronDao(newVendor[0].user_id),
    ]);

    if (!prevVendorCalc[0] || !newVendorCalc[0]) {
      throw new NotFoundError('Calculation data not found');
    }

    const approvedDate = getDateWithoutTime(botRes.created_at);
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
      Math.abs(botRes.amount),
      prevVendor[0].payin_commission,
    );
    const newVendorCommission = calculateCommission(
      Math.abs(botRes.amount),
      newVendor[0].payin_commission,
    );

    await Promise.all([
      updateBankaccountDao(
        { id: prevBank[0].id, company_id },
        {
          balance: prevBank[0].balance - botRes.amount,
          today_balance: prevBank[0].today_balance - botRes.amount,
          updated_by: user_id,
        },
      ),
      updateBankaccountDao(
        { id: newBank[0].id, company_id },
        {
          balance: newBank[0].balance + botRes.amount,
          today_balance: newBank[0].today_balance + botRes.amount,
          updated_by: user_id,
        },
      ),
      updateBotResponseDao(
        botRes.id,
        updateData,
        conn,
      ),
      updateCalculationBalances(
        prevVendorCurrentCalcs,
        prevVendorNextCurrentCalcs,
        -botRes.amount,
        prevVendorCommission,
        conn,
      ),
      updateCalculationBalances(
        newVendorCurrentCalcs,
        newVendorNextCurrentCalcs,
        botRes.amount,
        newVendorCommission,
        conn,
      ),
    ]);
  } catch (error) {
    logger.error('Error in handle bank id update:', error.message);
    throw error;
   }
};

// Update pay-in data
const updatePayInData = async ({ payInData, user_name, botRes }) => {
  try {
    const isEqualUTR = payInData?.some(
      (item) => item.user_submitted_utr === botRes.utr,
    );
    const isEqualBotResponse = payInData?.some(
      (item) => item.bank_response_id === botRes.id,
    );

    let updatePayinID;
    if (isEqualUTR) {
      updatePayinID = payInData.filter(
        (item) =>
          item.user_submitted_utr === botRes.utr && item.status !== Status.FAILED,
      );
    } else if (isEqualBotResponse) {
      updatePayinID = payInData.filter(
        (item) =>
          item.bank_response_id === botRes.id &&
          [Status.FAILED, Status.DISPUTE, Status.BANK_MISMATCH].includes(
            item.status,
          ),
      );
    }

    if (updatePayinID?.length) {
      const updatePayinData = {
        status:
          new Date().getTime() - new Date(updatePayinID[0].created_at).getTime() <
            10 * 60 * 1000
            ? Status.ASSIGNED
            : Status.DROPPED,
        user_submitted_utr: null,
        bank_response_id: null,
        updated_by: user_name,
      };
      await updatePayInUrlDao(updatePayinID[0].id, updatePayinData);
    }
  }
  catch (error) {
    logger.error('Error in updatePayin Data', error.message);
      throw error;
    }
};

// Function to clean and normalize text
function cleanText(text) {
  return text
    .replace(/[\n\r]+/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

// Function to extract reference number (UTR, NEFT, IMPS)
function extractReferenceNumber(description) {
  // UPI: 12-digit number
  const upiMatch = description.match(/UPI[:\/]([0-9]{12})/i);
  if (upiMatch) return upiMatch[1];

  // NEFT: 10-16 digit alphanumeric
  const neftMatch = description.match(
    /NEFT[\/-](?:CR|INWARD)?[\/-]?([A-Za-z0-9]{10,16})/i,
  );
  if (neftMatch) return neftMatch[1];

  // IMPS: 10-12 digit number
  const impsMatch = description.match(/IMPS[\/:]([0-9]{10,12})/i);
  if (impsMatch) return impsMatch[1];

  return null;
}

// Function to parse amount (handles INR prefix, commas, and signs)
function parseAmount(amount) {
  if (!amount || amount === '-' || amount === 'NIL') return null;
  const isNegative = amount.startsWith('-');
  const cleaned = amount.replace(/[^0-9.]/g, '');
  const value = parseFloat(cleaned);
  return isNegative ? -value : value;
}

// Function to format transaction as space-separated string
function formatTransaction(transaction) {
  return `${transaction.amount} undefined ${transaction.utr} ${transaction.bank_id} ${transaction.isProcessed}`;
}

// Function to extract credited transactions from PDF buffer
async function extractCreditedTransactions(pdfBuffer, bankId) {
  try {
    const parser = new PDFParser();
    const data = await new Promise((resolve, reject) => {
      parser.on('pdfParser_dataReady', (pdfData) => resolve(pdfData));
      parser.on('pdfParser_dataError', (err) => reject(err));
      parser.parseBuffer(pdfBuffer);
    });

    const transactions = [];
    let isTransactionSection = false;
    let headers = [];
    let amountColumnIndex = -1;
    let balanceColumnIndex = -1;
    let previousBalance = null;
    let rowAccumulator = [];
    let currentRow = [];

    // Iterate through pages
    for (const page of data.Pages) {
      let currentTransaction = {};

      // Iterate through text elements
      for (const text of page.Texts) {
        const decodedText = decodeURIComponent(text.R[0].T);
        const cleanedText = cleanText(decodedText);
        if (!cleanedText) continue;

        // Detect start of transaction table
        if (
          !isTransactionSection &&
          (/Date/i.test(cleanedText) ||
            /(Amount|Balance|Transaction|Credit|Credits|Debit|Debits)/i.test(
              cleanedText,
            ))
        ) {
          isTransactionSection = true;
          headers = cleanedText.split(/\s+/).filter((h) => h);
          amountColumnIndex = headers.findIndex((h) =>
            /Amount|Transaction|Credit|Credits/i.test(h),
          );
          balanceColumnIndex = headers.findIndex((h) => /Balance/i.test(h));
          continue;
        }

        // Check if the text is a date to start a new row
        if (
          cleanedText.match(/^\d{2}[,\/-]\d{2}[,\/-]\d{4}$/) ||
          cleanedText.match(/^\d{2}\s+[A-Za-z]{3}\s+\d{4}$/)
        ) {
          if (currentRow.length > 0) {
            // Process the previous row
            const columns = currentRow
              .join(' ')
              .split(/\s+/)
              .filter((c) => c);

            if (
              columns[0].match(/^\d{2}[,\/-]\d{2}[,\/-]\d{4}$/) ||
              columns[0].match(/^\d{2}\s+[A-Za-z]{3}\s+\d{4}$/)
            ) {
              isTransactionSection = true;
              if (Object.keys(currentTransaction).length > 0) {
                transactions.push(currentTransaction);
              }
              currentTransaction = { date: columns[0] };

              // Combine description until numeric value
              let descriptionParts = [];
              let i = 1;
              while (
                i < columns.length &&
                !columns[i].match(/^-?\d+[,.]?\d*$/) &&
                !columns[i].match(/^INR\s*\d+[,.]?\d*$/)
              ) {
                descriptionParts.push(columns[i]);
                i++;
              }
              currentTransaction.description = descriptionParts.join(' ');
              currentTransaction.referenceNumber = extractReferenceNumber(
                currentTransaction.description,
              );

              // Assign amount and balance
              if (amountColumnIndex !== -1 && columns[amountColumnIndex]) {
                currentTransaction.amount = parseAmount(
                  columns[amountColumnIndex],
                );
              } else {
                for (let j = columns.length - 1; j >= 1; j--) {
                  if (
                    columns[j].match(/^-?\d+[,.]?\d*$/) ||
                    columns[j].match(/^INR\s*\d+[,.]?\d*$/)
                  ) {
                    if (!currentTransaction.balance) {
                      currentTransaction.amount = parseAmount(columns[j]);
                      break;
                    }
                  }
                }
              }

              if (balanceColumnIndex !== -1 && columns[balanceColumnIndex]) {
                currentTransaction.balance = parseAmount(
                  columns[balanceColumnIndex],
                );
              } else {
                for (let j = columns.length - 1; j >= 1; j--) {
                  if (
                    columns[j].match(/^-?\d+[,.]?\d*$/) &&
                    !currentTransaction.amount
                  ) {
                    currentTransaction.balance = parseAmount(columns[j]);
                    break;
                  }
                }
              }

              // Infer amount from balance change
              if (
                !currentTransaction.amount &&
                currentTransaction.balance &&
                previousBalance !== null
              ) {
                const balanceChange =
                  currentTransaction.balance - previousBalance;
                if (balanceChange > 0) {
                  currentTransaction.amount = balanceChange;
                }
              }

              // Fallback: Check description for credit keywords
              if (
                !currentTransaction.amount &&
                currentTransaction.description.match(/Received|Deposit|Credit/i)
              ) {
                const amountMatch =
                  currentTransaction.description.match(/(\d+[,.]?\d*)/);
                if (amountMatch)
                  currentTransaction.amount = parseFloat(amountMatch[1]);
              }

              // Add bank_id and isProcessed
              currentTransaction.bank_id = bankId;
              currentTransaction.isProcessed = true;

              previousBalance = currentTransaction.balance || previousBalance;
            }
          }
          // Start a new row
          currentRow = [cleanedText];
        } else if (isTransactionSection) {
          // Add to current row
          currentRow.push(cleanedText);
        } else {
          // Accumulate non-transaction text
          rowAccumulator.push(cleanedText);
        }
      }

      // Process the last row
      if (currentRow.length > 0) {
        const columns = currentRow
          .join(' ')
          .split(/\s+/)
          .filter((c) => c);

        if (
          columns[0].match(/^\d{2}[,\/-]\d{2}[,\/-]\d{4}$/) ||
          columns[0].match(/^\d{2}\s+[A-Za-z]{3}\s+\d{4}$/)
        ) {
          if (Object.keys(currentTransaction).length > 0) {
            transactions.push(currentTransaction);
          }
          currentTransaction = { date: columns[0] };

          let descriptionParts = [];
          let i = 1;
          while (
            i < columns.length &&
            !columns[i].match(/^-?\d+[,.]?\d*$/) &&
            !columns[i].match(/^INR\s*\d+[,.]?\d*$/)
          ) {
            descriptionParts.push(columns[i]);
            i++;
          }
          currentTransaction.description = descriptionParts.join(' ');
          currentTransaction.referenceNumber = extractReferenceNumber(
            currentTransaction.description,
          );

          if (amountColumnIndex !== -1 && columns[amountColumnIndex]) {
            currentTransaction.amount = parseAmount(columns[amountColumnIndex]);
          } else {
            for (let j = columns.length - 1; j >= 1; j--) {
              if (
                columns[j].match(/^-?\d+[,.]?\d*$/) ||
                columns[j].match(/^INR\s*\d+[,.]?\d*$/)
              ) {
                if (!currentTransaction.balance) {
                  currentTransaction.amount = parseAmount(columns[j]);
                  break;
                }
              }
            }
          }

          if (balanceColumnIndex !== -1 && columns[balanceColumnIndex]) {
            currentTransaction.balance = parseAmount(
              columns[balanceColumnIndex],
            );
          } else {
            for (let j = columns.length - 1; j >= 1; j--) {
              if (
                columns[j].match(/^-?\d+[,.]?\d*$/) &&
                !currentTransaction.amount
              ) {
                currentTransaction.balance = parseAmount(columns[j]);
                break;
              }
            }
          }

          if (
            !currentTransaction.amount &&
            currentTransaction.balance &&
            previousBalance !== null
          ) {
            const balanceChange = currentTransaction.balance - previousBalance;
            if (balanceChange > 0) {
              currentTransaction.amount = balanceChange;
            }
          }

          if (
            !currentTransaction.amount &&
            currentTransaction.description.match(/Received|Deposit|Credit/i)
          ) {
            const amountMatch =
              currentTransaction.description.match(/(\d+[,.]?\d*)/);
            if (amountMatch)
              currentTransaction.amount = parseFloat(amountMatch[1]);
          }

          // Add bank_id and isProcessed
          currentTransaction.bank_id = bankId;
          currentTransaction.isProcessed = true;

          previousBalance = currentTransaction.balance || previousBalance;
          transactions.push(currentTransaction);
        }
      }
    }

    // Filter credited transactions and format as strings
    const creditedTransactions = transactions
      .filter((t) => t.amount && t.amount > 0 && t.referenceNumber) // Exclude utr == "N/A"
      .map((t) => ({
        amount: t.amount,
        utr: t.referenceNumber,
        bank_id: t.bank_id,
        isProcessed: t.isProcessed,
      }))
      .map((t) => formatTransaction(t));

    console.log('Credited Transactions:', creditedTransactions);
    return creditedTransactions;
  } catch (error) {
    logger.error('Error in extractCreditedTransactions:', error);
    throw error;
  }
}

// Main service function
const importBankResponseService = async (
  conn,
  payload,
  companyId,
  role,
  name,
) => {
  try {
    // Validate payload
    if (!payload || !payload.pdfBuffer) {
      throw new Error('No valid PDF buffer provided in payload');
    }

    // Extract credited transactions
    const creditedTransactions = await extractCreditedTransactions(
      payload.pdfBuffer,
      payload.bank_id,
    );

    for (const transaction of creditedTransactions) {
      await createBankResponseService(conn, transaction, companyId, role, name);
    }

    return {
      message: `${payload.fileType} imported successfully`,
    };
  } catch (error) {
    logger.error('Error in importBankResponseService:', error);
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
  conn,
) => {
  if (!currentCalculation) return;

  const updates = {
    total_payin_commission: amountDiff > 0 ? commission : -commission,
    total_payin_amount: amountDiff,
    current_balance: amountDiff - commission,
    net_balance: amountDiff - commission,
  };

  // Update current calculation
  await updateCalculationBalanceDao(
    { id: currentCalculation[0].id },
    updates,
    conn,
  );

  if (nextCalculations.length > 0) {
    // Update subsequent calculations
    for (const calc of nextCalculations) {
      await updateCalculationBalanceDao(
        { id: calc.id },
        {
          net_balance: amountDiff - commission,
        },
        conn,
      );
    }
  }
};

export {
  getBankResponseService,
  getClaimResponseService,
  createBankResponseService,
  updateBankResponseService,
  getBankMessageServices,
  getBankResponseBySearchService,
  resetBankResponseService,
  importBankResponseService,
};
