/* eslint-disable no-useless-escape */
import {
  BadRequestError,
  // InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';
import dayjs from 'dayjs';
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
  getForCreateBankResponseDao,
  getCheckBankResponseDao,
} from './bankResponseDao.js';
import { logger } from '../../utils/logger.js';
import {
  getBankaccountDao,
  updateBankaccountDao,
  getBankaccountCheckDao,
  getBankaccountDashBoardReportDao,
  getBankIdsOnlyDao,
  atomicUpdateBankBalanceDao,
  atomicDecrementBankBalanceDao,
  updateBankAccountBalanceDao
} from '../bankAccounts/bankaccountDao.js';
import {
  // getPayInUrlsDao,
  getPayInsBankResDao,
  getPayInsForResetBankResDao,
  updatePayInUrlDao,
} from '../payIn/payInDao.js';
import { getMerchantsBankResponseDao } from '../merchants/merchantDao.js';
import { calculateCommission } from '../../utils/calculation.js';
import {
  getVendorsDao,
  // updateVendorDao,
  getVendorsBankReponseDao,
} from '../vendors/vendorDao.js';
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
import { _updateBankaccountInternal } from '../bankAccounts/bankaccountServices.js';
import PDFParser from 'pdf2json';
import { calculateDuration } from '../../helpers/index.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { trackVendorsNetBalance } from '../../utils/trackVendorsNetBalance.js';
import { emitTableEntryAsync } from '../../utils/socket/sessionUtils.js';
// import { acquireUTRLock } from '../../utils/advisoryLock.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';

const processingSet = new Set();

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const BANK_RESPONSE_LOCK_TIMEOUT_MS = parsePositiveInt(
  process.env.BANK_RESPONSE_DB_LOCK_TIMEOUT_MS,
  10000,
);
const BANK_RESPONSE_STATEMENT_TIMEOUT_MS = parsePositiveInt(
  process.env.BANK_RESPONSE_DB_STATEMENT_TIMEOUT_MS,
  45000,
);
const BANK_RESPONSE_DEFAULT_WINDOW_DAYS = parsePositiveInt(
  process.env.BANK_RESPONSE_DEFAULT_WINDOW_DAYS,
  2,
);

const applyDefaultBankResponseDateWindow = (payload) => {
  if (payload?.startDate || payload?.endDate) {
    return payload;
  }

  return {
    ...payload,
    startDate: dayjs()
      .subtract(BANK_RESPONSE_DEFAULT_WINDOW_DAYS, 'day')
      .format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
  };
};

const shouldApplyDefaultBankResponseDateWindow = (payload = {}) => {
  if (payload?.startDate || payload?.endDate) {
    return false;
  }

  const relevantEntries = Object.entries(payload).filter(([key, value]) => {
    if (key === 'company_id') {
      return false;
    }

    return value !== undefined && value !== null && value !== '';
  });

  if (relevantEntries.length === 0) {
    return true;
  }

  if (relevantEntries.length !== 2) {
    return false;
  }

  const relevantQuery = Object.fromEntries(relevantEntries);
  return (
    String(relevantQuery.page) === '1' &&
    String(relevantQuery.limit) === '20'
  );
};

export const applyBankResponseTxTimeouts = async (conn) => {
  await conn.query(
    `SET LOCAL lock_timeout = '${BANK_RESPONSE_LOCK_TIMEOUT_MS}ms'`,
  );
  await conn.query(
    `SET LOCAL statement_timeout = '${BANK_RESPONSE_STATEMENT_TIMEOUT_MS}ms'`,
  );
};


export const runPostCommitTasks = (tasks, context) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return;
  }

  setImmediate(() => {
    tasks.forEach((task, index) => {
      Promise.resolve()
        .then(() => task())
        .catch((error) => {
          logger.error(
            `Post-commit task failed for ${context} at index ${index}`,
            error,
          );
        });
    });
  });
};

// Helper function to check if vendor is sub-vendor and get parent info
export const getSubVendorParentInfo = async (vendor, conn = null) => {
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
    const userHierarchys = await getUserHierarchysDao(
      {
        user_id: vendor.user_id,
      },
      null,
      null,
      null,
      null,
      [],
      conn,
    );
    const userHierarchy = userHierarchys?.[0];
    const parentId = userHierarchy?.config?.parent;

    if (!parentId) {
      logger.warn(`Sub-vendor ${vendor.user_id} has no parent in hierarchy`);
      return null;
    }

    // Get parent vendor details
    const parentVendors = await getVendorsBankReponseDao(
      { user_id: parentId },
      conn,
    );
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
export const updateParentVendorCalculation = async (
  parentUserId,
  amount,
  vendorCommissionRate,
  conn = null,
  options = {},
) => {
  try {
    const parentCommission = calculateCommission(amount, vendorCommissionRate);

    await updateCalculationTable(
      parentUserId,
      {
        payinCommission: parentCommission,
        amount: 0, // Parent vendor amount is always 0, only commission is tracked
      },
      conn,
      options,
    );

    return parentCommission;
  } catch (error) {
    logger.error('Error in updateParentVendorCalculation:', error);
    throw error;
  }
};

const createBankResponseService = async (
  payload,
  companyId,
  role,
  name,
  // user_id,
) => {
  let conn;
  let committed = false;
  const postCommitTasks = [];
  const { amount, upi_short_code, utr,bank_id, from_UI } = payload;
  // const splitData = payload.split(' ');
  // const amount = Number.parseFloat(payload.amount[0]);
  // const upi_short_code = splitData.length > 1 ? splitData[1] : '';
  // const utr = splitData[2];
  // const bank_id = splitData[3];
  // const from_UI = splitData[4];
  let vendor;

  // Check for concurrent duplicate UTR immediately (in-memory check)
  if (processingSet.has(utr)) {
    logger.warn(`Duplicate concurrent add data skipped for ${utr}`);
    return { message: `Duplicate UTR ${utr} already being processed` };
  }
  processingSet.add(utr);

  try {
    // Database-level lock to prevent race condition with concurrent requests
    // const lockAcquired = await acquireUTRLock(utr, conn);
    // if (!lockAcquired) {
    //   logger.warn(`UTR ${utr} is already locked - concurrent processing detected`);
    //   return { message: `UTR ${utr} is being processed by another request. Please try again.` };
    // }

    // Early validation (synchronous)
    const isValidAmount = amount >= 1 && amount <= 500000;
    if (!isValidAmount) {
      throw new BadRequestError(`amount must be between 1 and 500000`);
    }

    // UTR validation (synchronous)
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
    const isValidAmountCode = !!(
      upi_short_code &&
      upi_short_code !== 'nil' &&
      upi_short_code.length === 5
    );

    const acceptedStatus = [
      Status.SUCCESS,
      Status.DISPUTE,
      Status.BANK_MISMATCH,
      Status.FAILED,
      Status.DUPLICATE,
    ];
    if (
      upi_short_code !== 'undefined' &&
      upi_short_code !== 'nil' &&
      !isValidAmountCode
    ) {
      throw new BadRequestError(`Please Enter valid Amount Code!`);
    }

    // Optimized: Parallelize bank validation and UTR existence check
    const [bankCompanyCheck, utrAlreadyExist] = await Promise.all([
      getBankaccountCheckDao(
        {
          id: bank_id,
          company_id: companyId,
          bank_used_for: 'PayIn',
        },
      ),
      isValidAmountCode
        ? getCheckBankResponseDao(
          {
            upi_short_code,company_id
          },
            null,
          ).then(
            (result) =>
              result || getCheckBankResponseDao({ utr, company_id }, null),
          )
        : getCheckBankResponseDao({ utr, company_id }, null),
    ]);

    if (!bankCompanyCheck) {
      throw new NotFoundError('Bank account does not exist for this company');
    }
    const isRepeated = utrAlreadyExist;

    const updatedData = {
      status: isRepeated ? '/repeated' : '/success',
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

    // if (isValidAmountCode) {
    //   const isAmountCodeExist = await getBankResponseDao(
    //     { upi_short_code, company_id },
    //     null,
    //     null,
    //     null,
    //     null,
    //     filterColumns,
    //   );
    //   if (isAmountCodeExist) {
    //     return { message: 'Amount code already exist' };
    //   }
    // }

    // const sendNotification = async (status, data) => {
    //   await notifyNewTableEntry(tableName.BANK_RESPONSE, status, data);
    // };

    let botRes;

    // Use a transaction for all DB operations for a single entry
    try {
      // Start transaction only when write phase begins to reduce connection hold time
      conn = await getConnection();
      await beginTransaction(conn);
      await applyBankResponseTxTimeouts(conn);
      botRes = await createBankResponseDao(updatedData, conn);
      // await sendNotification(updatedData.status.replace('/', ''), {
      //   id: botRes.id,
      //   utr: botRes.utr,
      //   amount: botRes.amount,
      //   bank_id: botRes.bank_id,
      //   company_id: botRes.company_id,
      //   created_by: botRes.created_by,
      // });

      if (updatedData.status === '/repeated') {
        await commit(conn);
        committed = true;
        processingSet.delete(utr);
        conn.release();
        conn = null; // Prevent double release in finally block
        if (isValidAmountCode) {
          return {
            message: `Entry with REPEATED AMOUNT CODE: ${upi_short_code} Added`,
          };
        } else {
          return { message: `Entry with REPEATED UTR: ${utr} Added` };
        }
      }
      let bankDetails = [];
      ////for bank account ////vendor calculation
      if (botRes.status === '/success') {
        bankDetails = await getBankaccountDashBoardReportDao(
          {
            id: botRes?.bank_id,
            company_id: companyId,
          },
          conn,
        );
        if (
          isNaN(bankDetails[0].balance) ||
          isNaN(bankDetails[0].today_balance)
        ) {
          throw new BadRequestError('Invalid amount or commission');
        }

        const res = await updateBankAccountBalanceDao(
          { id: botRes?.bank_id, company_id: companyId },
          {
            balance: parseFloat(botRes.amount),
            today_balance: parseFloat(botRes.amount),
            payin_count: 1,
          },
          conn,
        );

        vendor = await getVendorsBankReponseDao(
          {
            user_id: bankDetails[0].user_id,
          },
          conn,
        );

        await _updateBankaccountInternal(
          { id: botRes?.bank_id, company_id: companyId },
          { latest_balance: res.today_balance },
          role,
          conn,
        );
        // if (isNaN(vendor[0].balance)) {
        //   throw new BadRequestError('Invalid amount or commission');
        // }
        // await updateVendorDao(
        //   { id: vendor[0].id },
        //   {
        //     balance: parseFloat(vendor[0].balance) + parseFloat(botRes.amount),
        //   },
        //   conn,
        // );
        const payinVendorCommission = calculateCommission(
          botRes.amount,
          vendor[0].payin_commission,
        );

        // Handle sub-vendor and parent commission logic immediately upon bank response creation
        let totalVendorCommission = payinVendorCommission;
        let parentCommission = 0;

        const subVendorParentInfo = await getSubVendorParentInfo(
          vendor[0],
          conn,
        );
        if (subVendorParentInfo) {
          // Calculate parent commission
          parentCommission = await updateParentVendorCalculation(
            subVendorParentInfo.parentUserId,
            Number(botRes.amount),
            Number(vendor[0].config?.mediator_payin_commission) || 0,
            conn,
            { postCommitTasks },
          );
          totalVendorCommission = payinVendorCommission + parentCommission;
          logger.info(
            `Sub-vendor commission calculated immediately on bankResponse creation: sub=${payinVendorCommission}, parent=${parentCommission}, total=${totalVendorCommission}`,
          );
        }

        await updateCalculationTable(
          vendor[0].user_id,
          {
            payinCommission: payinVendorCommission,
            amount: botRes.amount,
          },
          conn,
          { postCommitTasks },
        );
      }
      let duration;
      // Optimized: Single query for payin lookup
      const checkPayInUtr = await getPayInsBankResDao(
        isValidAmountCode
          ? { upi_short_code: upi_short_code, company_id: companyId }
          : { user_submitted_utr: utr, company_id: companyId },
        conn,
      );

      if (checkPayInUtr?.length > 0) {
        const payInUtr =
          checkPayInUtr.length === 1
            ? checkPayInUtr[0]
            : checkPayInUtr[checkPayInUtr.length - 1];

        // Optimized: Parallelize validation queries
        const [getDataByUtr, isBankExist] = await Promise.all([
          upi_short_code && isValidAmountCode
            ? getForCreateBankResponseDao(
                {
                  utr: payInUtr.user_submitted_utr,
                  company_id,
                },
                null,
                conn,
              )
            : Promise.resolve(null),
          getBankaccountDashBoardReportDao(
            {
              id: bank_id,
              company_id,
            },
            conn,
          ),
        ]);

        if (getDataByUtr) {
          const botUtrIsUsed =
            getDataByUtr.rows?.length > 1 &&
            getDataByUtr.some((item) => item.is_used);
          if (!acceptedStatus.includes(payInUtr.status) && botUtrIsUsed) {
            await commit(conn);
            committed = true;
            processingSet.delete(utr);
            conn.release();
            conn = null; // Prevent double release in finally block
            return {
              message: `The entry is already ${payInUtr.status} with UTR`,
            };
          }
        }

        if (
          isBankExist &&
          (isBankExist[0]?.config?.is_freeze === true ||
            isBankExist[0]?.freezed === 'true') &&
          role !== Role.ADMIN
        ) {
          await commit(conn);
          committed = true;
          processingSet.delete(utr);
          conn.release();
          conn = null; // Prevent double release in finally block
          return {
            message: `Entry Created Successfully. But as Bank Account is freezed entry is not paired. Please contact admin`,
          };
        }

        if (!isBankExist || payInUtr.bank_acc_id !== bank_id) {
          if (
            (payInUtr.user_submitted_utr !== utr &&
              isValidAmountCode &&
              upi_short_code !== payInUtr.upi_short_code) ||
            (isValidAmountCode && upi_short_code !== payInUtr.upi_short_code)
          ) {
            await commit(conn);
            committed = true;
            processingSet.delete(utr);
            conn.release();
            conn = null; // Prevent double release
            if (isValidAmountCode && payInUtr.upi_short_code) {
              return {
                message: `⛔ Amount Code: ${upi_short_code} does not match with User Submitted Amount Code: ${payInUtr.upi_short_code}`,
              };
            } else {
              return {
                message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${payInUtr.user_submitted_utr}`,
              };
            }
          }
          duration = calculateDuration(payInUtr.created_at);
          const payInData = {
            status: Status.BANK_MISMATCH,
            is_notified: true,
            user_submitted_utr: botRes.utr,
            bank_response_id: botRes.id,
            // approved_at: new Date(),
            // config: { from_UI },
            duration,
          };

          // Optimized: Parallelize payin update, merchant fetch, and bank update
          const [updatePayInDataRes, merchantData] = await Promise.all([
            updatePayInUrlDao(
              payInUtr.id,
              payInData,
              conn,
            ),
            getMerchantsBankResponseDao(
              {
                id: payInUtr.merchant_id,
              },
              conn,
            ),
            updateBotResponseDao(botRes.id, { is_used: true }, conn),
          ]);

          const currentPayinBank = await getBankaccountDashBoardReportDao(
            {
              id: payInUtr.bank_acc_id,
              company_id: companyId,
            },
            conn,
          );
          let obj = {};
          if (updatePayInDataRes) {
            obj = {
              id: updatePayInDataRes.id,
              status: updatePayInDataRes.status,
              company_id: updatePayInDataRes.company_id,
              merchant_order_id: updatePayInDataRes.merchant_order_id,
              amount: updatePayInDataRes.amount || 0,
              merchant_id: merchantData[0]?.merchant_id || null,
              payin_merchant_commission:
                updatePayInDataRes.payin_merchant_commission || 0,
              payin_vendor_commission:
                updatePayInDataRes.payin_vendor_commission || 0,
              duration: updatePayInDataRes.duration || 0,
              created_at: updatePayInDataRes.created_at,
              updated_at: updatePayInDataRes.updated_at,
              user_submitted_utr: updatePayInDataRes.user_submitted_utr || null,
              bank_acc_id: updatePayInDataRes.bank_acc_id || null,
              nick_name: currentPayinBank[0]?.nick_name || '',
              user: updatePayInDataRes.user || null,
              vendor_code: (vendor && vendor[0]?.code) || null,
              vendor_user_id: (vendor && vendor[0]?.user_id) || null,
              bank_response_id: updatePayInDataRes.bank_response_id || null,
              config: updatePayInDataRes.config || {},
              merchant_details: {
                merchant_code: merchantData[0]?.code || '',
                dispute: updatePayInDataRes.status === Status.DISPUTE,
                return_url: updatePayInDataRes.config?.urls?.return || null,
                notify_url: updatePayInDataRes.config?.urls?.notify || null,
              },
              bank_res_details: {
                utr: botRes.utr || null,
                amount: botRes.amount || 0,
              },
            };
            // This is async function but it's just the callback sending function there fore we are not using await
            merchantPayinCallback(updatePayInDataRes.config.urls?.notify, {
              status: updatePayInDataRes.status,
              merchantOrderId: updatePayInDataRes.merchant_order_id,
              payinId: updatePayInDataRes.id,
              amount: botRes.amount,
              req_amount: updatePayInDataRes.amount,
              utr_id: updatePayInDataRes.user_submitted_utr,
            });
          }
          // await sendNotification(Status.BANK_MISMATCH, {
          //   id: payInUtr.id,
          //   user_submitted_utr: botRes.utr,
          //   bank_response_id: botRes.id,
          //   merchant_order_id: updatePayInDataRes?.merchant_order_id,
          // });
          await commit(conn);
          committed = true;
          processingSet.delete(utr);
          conn.release();
          conn = null; // Prevent double release in finally block

          emitTableEntryAsync(tableName.PAYIN, obj);
          return {
            message: `Bank Mismatch with ${updatePayInDataRes?.merchant_order_id}`,
          };
        }

        const existingResponse = await getForCreateBankResponseDao(
          {
            utr,
            is_used: true,
            company_id,
          },
          null,
          conn,
        );
        if (existingResponse?.length > 0) {
          await commit(conn);
          committed = true;
          processingSet.delete(utr);
          conn.release();
          conn = null; // Prevent double release in finally block
          return { message: `The UTR already exists` };
        }

        // Optimized: Parallelize merchant and bank account fetches
        const [merchantData, bankAccountDetails] = await Promise.all([
          getMerchantsBankResponseDao(
            {
              id: payInUtr.merchant_id,
            },
            conn,
          ),
          getBankaccountDashBoardReportDao(
            {
              id: payInUtr.bank_acc_id,
              company_id,
            },
            conn,
          ),
        ]);

        if (!merchantData?.[0]) {
          throw new NotFoundError(
            `Merchant not found for payin merchant_id: ${payInUtr.merchant_id}`,
          );
        }

        if (!bankAccountDetails?.[0]?.user_id) {
          throw new NotFoundError(
            `Bank account not found for payin bank_acc_id: ${payInUtr.bank_acc_id}`,
          );
        }

        const vendorData = await getVendorsBankReponseDao(
          {
            user_id: bankAccountDetails[0].user_id,
          },
          conn,
        );

        if (!vendorData?.[0]) {
          throw new NotFoundError(
            `Vendor not found for bank account user_id: ${bankAccountDetails[0].user_id}`,
          );
        }

        const payinMerchantCommission = calculateCommission(
          botRes.amount,
          merchantData[0].payin_commission,
        );
        const payinVendorCommission = calculateCommission(
          botRes.amount,
          vendorData[0].payin_commission,
        );

        if (
          payInUtr.amount === amount ||
          (isValidAmountCode &&
            isValidAmountCode === payInUtr.upi_short_code &&
            payInUtr.amount === amount)
        ) {
          if (
            (payInUtr.user_submitted_utr !== utr &&
              isValidAmountCode &&
              upi_short_code !== payInUtr.upi_short_code) ||
            (isValidAmountCode && upi_short_code !== payInUtr.upi_short_code)
          ) {
            await commit(conn);
            committed = true;
            processingSet.delete(utr);
            conn.release();
            conn = null; // Prevent double release
            if (isValidAmountCode && payInUtr.upi_short_code) {
              return {
                message: `⛔ Amount Code: ${upi_short_code} does not match with User Submitted Amount Code: ${payInUtr.upi_short_code}`,
              };
            } else {
              return {
                message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${payInUtr.user_submitted_utr}`,
              };
            }
          }
          duration = calculateDuration(payInUtr.created_at);

          // Handle sub-vendor and parent commission logic
          let totalVendorCommission = payinVendorCommission;
          let brokerageCommission = 0;
          let parentCommission = 0;
          let payinConfig = {};

          const subVendorParentInfo = await getSubVendorParentInfo(
            vendorData[0],
            conn,
          );
          if (subVendorParentInfo) {
            // Calculate parent commission
            // parentCommission = await updateParentVendorCalculation(
            //   subVendorParentInfo.parentUserId,
            //   Number(botRes.amount),
            //   Number(subVendorParentInfo.parentVendor.payin_commission),
            //   conn,
            // );

            totalVendorCommission = payinVendorCommission + parentCommission;
            brokerageCommission = parentCommission;

            // Preserve existing config and only update commission keys
            payinConfig = {
              ...(payInUtr.config || {}), // Preserve existing config
              actual_vendor_commission: payinVendorCommission,
              brokerage_commission: brokerageCommission,
            };
            logger.info(
              `Sub-vendor commission calculated in bankResponse: sub=${payinVendorCommission}, parent=${parentCommission}, total=${totalVendorCommission}`,
            );
          } else {
            // Preserve existing config and only update commission keys
            payinConfig = {
              ...(payInUtr.config || {}), // Preserve existing config
              actual_vendor_commission: payinVendorCommission,
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
            config: payinConfig,
            bank_response_id: botRes.id,
          };
          const updatePayin = await updatePayInUrlDao(
            payInUtr.id,
            payInData,
            conn,
          );
          await updateBotResponseDao(botRes.id, { is_used: true }, conn);

          const obj = {
            id: updatePayin.id,
            status: updatePayin.status,
            company_id: updatePayin.company_id,
            merchant_order_id: updatePayin.merchant_order_id,
            amount: updatePayin.amount || 0,
            merchant_id: merchantData[0]?.merchant_id || null,
            payin_merchant_commission:
              updatePayin.payin_merchant_commission || 0,
            payin_vendor_commission: updatePayin.payin_vendor_commission || 0,
            duration: updatePayin.duration || 0,
            created_at: updatePayin.created_at,
            updated_at: updatePayin.updated_at,
            nick_name: bankDetails[0]?.nick_name || '',
            user: updatePayin.user || null,
            vendor_code: (vendorData && vendorData[0]?.code) || null,
            vendor_user_id: (vendorData && vendorData[0]?.user_id) || null,
            user_submitted_utr: updatePayin.user_submitted_utr || null,
            bank_acc_id: updatePayin.bank_acc_id || null,
            bank_response_id: updatePayin.bank_response_id || null,
            config: updatePayin.config || {},
            merchant_details: {
              merchant_code: merchantData[0]?.code || '',
              dispute: updatePayin.status === Status.DISPUTE,
              return_url: updatePayin.config?.urls?.return || null,
              notify_url: updatePayin.config?.urls?.notify || null,
            },
            bank_res_details: {
              utr: botRes.utr || null,
              amount: botRes.amount || 0,
            },
          };

          // This is async function but it's just the callback sending function there fore we are not using await
          merchantPayinCallback(updatePayin.config.urls?.notify, {
            status: updatePayin.status,
            merchantOrderId: updatePayin.merchant_order_id,
            payinId: updatePayin.id,
            amount: botRes.amount,
            req_amount: updatePayin.amount,
            utr_id: updatePayin.user_submitted_utr,
          });
          const merchantDataBalance = merchantData[0].balance + amount;
          if (isNaN(merchantDataBalance)) {
            throw new BadRequestError('Invalid amount or commission');
          }
          await updateCalculationTable(
            merchantData[0].user_id,
            {
              payinCommission: payinMerchantCommission,
              amount: botRes.amount,
            },
            conn,
            { postCommitTasks },
          );
          await commit(conn);
          committed = true;
          processingSet.delete(utr);
          conn.release();
          conn = null; // Prevent double release

          emitTableEntryAsync(tableName.PAYIN, obj);
          return {
            message: `UTR ${utr} matches the User Submitted UTR: ${payInUtr.user_submitted_utr} and the payment was successful.`,
          };
        } else {
          if (
            (payInUtr.user_submitted_utr !== utr &&
              isValidAmountCode &&
              upi_short_code !== payInUtr.upi_short_code) ||
            (isValidAmountCode && upi_short_code !== payInUtr.upi_short_code)
          ) {
            await commit(conn);
            committed = true;
            processingSet.delete(utr);
            conn.release();
            conn = null; // Prevent double release
            if (isValidAmountCode && payInUtr.upi_short_code) {
              return {
                message: `⛔ Amount Code: ${upi_short_code} does not match with User Submitted Amount Code: ${payInUtr.upi_short_code}`,
              };
            } else {
              return {
                message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${payInUtr.user_submitted_utr}`,
              };
            }
          }
          duration = calculateDuration(payInUtr.created_at);
          const payInData = {
            status: Status.DISPUTE,
            is_notified: true,
            user_submitted_utr: botRes.utr,
            bank_response_id: botRes.id,
            // approved_at: new Date(),
            duration,
            payin_merchant_commission: payinMerchantCommission,
            payin_vendor_commission: payinVendorCommission,
            // config: { from_UI },
          };

          // Optimized: Parallelize payin update and bot response update
          const [updatePayInDataRes] = await Promise.all([
            updatePayInUrlDao(
              payInUtr.id,
              payInData,
              conn,
            ),
            updateBotResponseDao(botRes.id, { is_used: true }, conn),
          ]);
          let obj = {};
          if (updatePayInDataRes) {
            obj = {
              id: updatePayInDataRes.id,
              status: updatePayInDataRes.status,
              company_id: updatePayInDataRes.company_id,
              merchant_order_id: updatePayInDataRes.merchant_order_id,
              amount: updatePayInDataRes.amount || 0,
              merchant_id: merchantData[0]?.merchant_id || null,
              payin_merchant_commission:
                updatePayInDataRes.payin_merchant_commission || 0,
              payin_vendor_commission:
                updatePayInDataRes.payin_vendor_commission || 0,
              duration: updatePayInDataRes.duration || 0,
              created_at: updatePayInDataRes.created_at,
              updated_at: updatePayInDataRes.updated_at,
              user_submitted_utr: updatePayInDataRes.user_submitted_utr || null,
              bank_acc_id: updatePayInDataRes.bank_acc_id || null,
              bank_response_id: updatePayInDataRes.bank_response_id || null,
              nick_name: bankDetails[0]?.nick_name || '',
              user: updatePayInDataRes.user || null,
              vendor_code: vendorData[0]?.code || null,
              vendor_user_id: vendorData[0]?.user_id || null,
              config: updatePayInDataRes.config || {},
              merchant_details: {
                merchant_code: merchantData[0]?.code || '',
                dispute: updatePayInDataRes.status === Status.DISPUTE,
                return_url: updatePayInDataRes.config?.urls?.return || null,
                notify_url: updatePayInDataRes.config?.urls?.notify || null,
              },
              bank_res_details: {
                utr: botRes.utr || null,
                amount: botRes.amount || 0,
              },
            };
            // This is async function but it's just the callback sending function there fore we are not using await
            merchantPayinCallback(updatePayInDataRes.config.urls?.notify, {
              status: updatePayInDataRes.status,
              merchantOrderId: updatePayInDataRes.merchant_order_id,
              payinId: updatePayInDataRes.id,
              amount: botRes.amount,
              req_amount: updatePayInDataRes.amount,
              utr_id: updatePayInDataRes.user_submitted_utr,
            });
          }

          // await sendNotification(Status.DISPUTE, {
          //   id: payInUtr.id,
          //   user_submitted_utr: botRes.utr,
          //   bank_response_id: botRes.id,
          //   merchant_order_id: updatePayInDataRes?.merchant_order_id,
          // });
          await commit(conn);
          committed = true;
          processingSet.delete(utr);
          conn.release();
          conn = null; // Prevent double release

          emitTableEntryAsync(tableName.PAYIN, obj);
          return {
            message: `Entry is in Dispute with ${updatePayInDataRes?.merchant_order_id}`,
          };
        }
      }

      await commit(conn);
      committed = true;

      // const bankDetails = await getBankaccountDao(
      //   { id: botRes?.bank_id, company_id: companyId },
      //   null,
      //   null,
      //   role,
      // );
      //  let vendorData = bankDetails[0]
      //     ? await getVendorsDao({ user_id: bankDetails[0].user_id })
      //     : [];
      const responseObj = {
        id: botRes.id,
        sno: botRes.sno,
        status: botRes.status,
        bank_id: botRes.bank_id,
        amount: botRes.amount,
        upi_short_code: botRes.upi_short_code || null,
        utr: botRes.utr,
        is_used: botRes.is_used === 'true',
        created_at: botRes.created_at,
        updated_at: botRes.updated_at,
        created_by: botRes.created_by,
        config: botRes.config || {},
        updated_by: botRes.updated_by,
        details: {
          is_intent: bankDetails[0]?.config?.is_intent || false,
          merchants: bankDetails[0]?.config?.merchants || [],
          is_phonepay: bankDetails[0]?.config?.is_phonepay || false,
        },
        nick_name: bankDetails[0]?.nick_name || null,
        vendor_user_id: vendor[0]?.user_id || null,
        vendor_code: vendor[0]?.code || null,
        company_id: companyId,
      };
      // Send to socket for real-time update
      emitTableEntryAsync(tableName.BANK_RESPONSE, responseObj);
      return { message: `Entry created successfully`, data: responseObj };
    } catch (err) {
      logger.error('Error performating transactions', err);
      throw err;
    }
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error in createBankResponseService:', error.message);
    throw error;
  } finally {
    processingSet.delete(utr);
    if (committed) {
      runPostCommitTasks(postCommitTasks, 'createBankResponseService');
    }
    if (conn) conn.release();
  }
};

const createBankResponseWebHookService = async (
  payload,
  companyId,
  role,
  name,
  // user_id,
  webhookconn,
) => {
  let conn = webhookconn || null;
  let committed = false;
  const postCommitTasks = [];
  try {
    const splitData = payload.split(' ');
    const amount = parseFloat(splitData[0]);
    const upi_short_code = splitData.length > 1 ? splitData[1] : '';
    const utr = splitData[2];
    const bank_id = splitData[3];
    const from_UI = splitData[4];
    let vendor;

    // Early validation
    const isValidAmount = amount >= 1 && amount <= 500000;
    if (!isValidAmount) {
      throw new BadRequestError(`amount must be between 1 and 500000`);
    }
    const bankCompanyCheck = await getBankaccountCheckDao({
      id: bank_id,
      company_id: companyId,
      bank_used_for: 'PayIn',
    });
    if (!bankCompanyCheck) {
      throw new NotFoundError('Bank account does not exist for this company');
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
    const isValidAmountCode = !!(
      upi_short_code &&
      upi_short_code !== 'nil' &&
      upi_short_code.length === 5
    );

    if (
      upi_short_code !== 'undefined' &&
      upi_short_code !== 'nil' &&
      !isValidAmountCode
    ) {
      throw new BadRequestError(`Please Enter valid Amount Code!`);
    }

    let utrAlreadyExist;
    if (isValidAmountCode) {
      utrAlreadyExist = await getCheckBankResponseDao(
        {
          upi_short_code,
          company_id,
        },
        null,
      );
      if (!utrAlreadyExist) {
        utrAlreadyExist = await getCheckBankResponseDao(
          { utr, company_id },
          null,
        );
      }
    } else {
      utrAlreadyExist = await getCheckBankResponseDao(
        { utr, company_id },
        null,
      );
    }
    const isRepeated = utrAlreadyExist;

    const updatedData = {
      status: isRepeated ? '/repeated' : '/success',
      amount,
      utr,
      bank_id,
      // config: { from_UI },
      is_used: 'true',
      created_by,
      updated_by,
      company_id,
      ...(isValidAmountCode && { upi_short_code }),
    };

    // if (isValidAmountCode) {
    //   const isAmountCodeExist = await getBankResponseDao(
    //     { upi_short_code, company_id },
    //     null,
    //     null,
    //     null,
    //     null,
    //     filterColumns,
    //   );
    //   if (isAmountCodeExist) {
    //     return { message: 'Amount code already exist' };
    //   }
    // }

    // const sendNotification = async (status, data) => {
    //   await notifyNewTableEntry(tableName.BANK_RESPONSE, status, data);
    // };

    let botRes;

    // Use a transaction for all DB operations for a single entry
    try {
      if (!webhookconn) {
        conn = await getConnection();
        await beginTransaction(conn);
        await applyBankResponseTxTimeouts(conn);
      }
      botRes = await createBankResponseDao(updatedData, conn);
      // await sendNotification(updatedData.status.replace('/', ''), {
      //   id: botRes.id,
      //   utr: botRes.utr,
      //   amount: botRes.amount,
      //   bank_id: botRes.bank_id,
      //   company_id: botRes.company_id,
      //   created_by: botRes.created_by,
      // });

      if (updatedData.status === '/repeated') {
        if (!webhookconn) {await commit(conn);
        committed = true;
        conn.release();
        conn = null;} // Prevent double release
        if (isValidAmountCode) {
          return {
            message: `Entry with REPEATED AMOUNT CODE: ${upi_short_code} Added`,
          };
        } else {
          return { message: `Entry with REPEATED UTR: ${utr} Added` };
        }
      }
      let bankDetails = [];
      ////for bank account ////vendor calculation
      if (botRes.status === '/success') {
        bankDetails = await getBankaccountDashBoardReportDao({
          id: botRes?.bank_id,
          company_id: companyId,
        }, conn);
        if (
          isNaN(bankDetails[0].balance) ||
          isNaN(bankDetails[0].today_balance)
        ) {
          throw new BadRequestError('Invalid amount or commission');
        }
        // Using atomic increment to prevent race conditions on concurrent updates
        // const res = await atomicUpdateBankBalanceDao(
        //   { id: botRes?.bank_id, company_id: companyId },
        //   parseFloat(botRes.amount),
        //   null,
        //   conn,
        // );
        const res = await updateBankAccountBalanceDao(
          { id: botRes?.bank_id, company_id: companyId },
          {
            balance: parseFloat(botRes.amount),
            today_balance: parseFloat(botRes.amount),
            payin_count: 1,
          },
          conn,
        );
        await _updateBankaccountInternal(
          { id: botRes?.bank_id, company_id: companyId },
          { latest_balance: res.today_balance },
          role,
          conn,
        );
        vendor = await getVendorsBankReponseDao({
          user_id: bankDetails[0].user_id,
        }, conn);
        // if (isNaN(vendor[0]?.balance)) {
        //   throw new BadRequestError('Invalid amount or commission');
        // }
        // await updateVendorDao(
        //   { id: vendor[0].id },
        //   {
        //     balance: parseFloat(vendor[0].balance) + parseFloat(botRes.amount),
        //   },
        //   conn,
        // );
        const payinVendorCommission = calculateCommission(
          botRes.amount,
          vendor[0].payin_commission,
        );

        // Handle sub-vendor and parent commission logic immediately upon bank response creation
        let totalVendorCommission = payinVendorCommission;
        let parentCommission = 0;

        const subVendorParentInfo = await getSubVendorParentInfo(
          vendor[0],
          conn,
        );
        if (subVendorParentInfo) {
          // Calculate parent commission
          // parentCommission = await updateParentVendorCalculation(
          //   subVendorParentInfo.parentUserId,
          //   Number(botRes.amount),
          //   Number(subVendorParentInfo.parentVendor.payin_commission),
          //   conn,
          // );

          totalVendorCommission = payinVendorCommission + parentCommission;

          logger.info(
            `Sub-vendor commission calculated immediately on bankResponse webhook creation: sub=${payinVendorCommission}, parent=${parentCommission}, total=${totalVendorCommission}`,
          );
        }

        await updateCalculationTable(
          vendor[0].user_id,
          {
            payinCommission: payinVendorCommission,
            amount: botRes.amount,
          },
          conn,
          { postCommitTasks },
        );
      }

      if (!webhookconn) {await commit(conn);
      committed = true;}
      // const bankDetails = await getBankaccountDao(
      //   { id: botRes?.bank_id, company_id: companyId },
      //   null,
      //   null,
      //   role,
      // );
      //  let vendorData = bankDetails[0]
      //     ? await getVendorsDao({ user_id: bankDetails[0].user_id })
      //     : [];
      const responseObj = {
        id: botRes.id,
        sno: botRes.sno,
        status: botRes.status,
        bank_id: botRes.bank_id,
        amount: botRes.amount,
        upi_short_code: botRes.upi_short_code || null,
        utr: botRes.utr,
        is_used: botRes.is_used === 'true',
        created_at: botRes.created_at,
        updated_at: botRes.updated_at,
        created_by: botRes.created_by,
        config: botRes.config || {},
        updated_by: botRes.updated_by,
        details: {
          is_intent: bankDetails[0]?.config?.is_intent || false,
          merchants: bankDetails[0]?.config?.merchants || [],
          is_phonepay: bankDetails[0]?.config?.is_phonepay || false,
        },
        nick_name: bankDetails[0]?.nick_name || null,
        vendor_user_id: vendor[0]?.user_id || null,
        vendor_code: vendor[0]?.code || null,
        company_id: companyId,
      };
      // Send to socket for real-time update
      emitTableEntryAsync(tableName.BANK_RESPONSE, responseObj);
      return { message: `Entry created successfully`, data: responseObj };
    } catch (err) {
      logger.error('Error performing transactions', err);
      throw err;
    }
  } catch (error) {
    if ((conn && !committed) && !webhookconn) {
      await rollback(conn);
    }

    logger.error('Error in createBankResponseService:', error);
    throw error;
  } finally {
    if (committed && !webhookconn) {
      runPostCommitTasks(postCommitTasks, 'createBankResponseWebHookService');
    }
    if (conn && !webhookconn) {
      conn.release();
    }
  }
};

const updateCalculationTable = async (user_id, data, conn, options = {}) => {
  try {
    if (isNaN(data.amount - data.payinCommission)) {
      throw new BadRequestError('Invalid amount or commission');
    }
    if (user_id) {
      const calculationData = await getCalculationforCronDao(user_id, conn);
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

      if (Array.isArray(options.postCommitTasks)) {
        options.postCommitTasks.push(() =>
          trackVendorsNetBalance(user_id, response),
        );
      } else {
        await trackVendorsNetBalance(user_id, response);
      }
      return response;
    }
  } catch (error) {
    logger.error('Error in updateCalculationTable:', error);
    throw error;
  }
};

const getClaimResponseService = async (payload) => {
  try {
    let filters = Object.fromEntries(
      Object.entries({
        date: payload.date || undefined,
        startDate: payload.startDate || undefined,
        endDate: payload.endDate || undefined,
        banks: payload.bank_ids || undefined,
        vendors: payload.vendors || undefined,
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

const getBankResponseService = async (
  payload,
  role,
  page,
  limit,
  search,
  updated,
  sortBy,
  sortOrder,
  designation,
  user_id,
) => {
  try {
    // Only the plain default listing should get the default date window.
    // Any other query-driven request should scan full DB unless caller sends dates.
    if (shouldApplyDefaultBankResponseDateWindow(payload) && !search) {
      payload = applyDefaultBankResponseDateWindow(payload);
    }

    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.BANK_RESPONSE
        : role === Role.VENDOR || role === Role.SUB_VENDOR
          ? vendorColumns.BANK_RESPONSE
          : columns.BANK_RESPONSE;

    const sno = Number(payload.sno) > 0 ? Number(payload.sno) : undefined;
    const amount =
      Number(payload.amount) > 0 ? Number(payload.amount) : undefined;

    let filters = Object.fromEntries(
      Object.entries({
        sno,
        status: payload.status || undefined,
        amount,
        utr: payload.utr || undefined,
        bank_id: payload.bank_id || undefined,
        is_used: payload.is_used || undefined,
        company_id: payload.company_id || undefined,
        userId: payload.userId || undefined,
      }).filter(([, v]) => v !== undefined),
    );
    filters = {
      ...(search ? { search } : {}),
      ...filters,
    };
    sortBy = sortBy ? sortBy : updated ? 'updated_at' : 'sno';

    // Use lightweight query for bank IDs only (avoid heavy BankAccount joins/stats)
    const fetchBankIds = async (user_ids) => {
      try {
        const userIdArray = Array.isArray(user_ids) ? user_ids : [user_ids];
        return await getBankIdsOnlyDao(userIdArray, 'PayIn');
      } catch (error) {
        logger.error('Error fetching PayIn bank IDs:', error);
        return [];
      }
    };

    // Optimized: Parallelize hierarchy queries where possible
    if (
      (designation === Role.VENDOR ||
        (designation === Role.VENDOR_ADMIN && !filters.bank_id)) &&
      !filters.bank_id
    ) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchys?.[0];

      const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];
      const vendorUserIds =
        Array.isArray(subVendors) && subVendors.length > 0
          ? [user_id, ...subVendors]
          : [user_id];
      filters.bank_id = await fetchBankIds(vendorUserIds);
    } else if (designation === Role.SUB_VENDOR && !filters.bank_id) {
      filters.bank_id = await fetchBankIds(user_id);
    } else if (designation === Role.VENDOR_OPERATIONS && !filters.bank_id) {
      // Optimized: Fetch both hierarchies in parallel
      const userHierarchys = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchys?.[0];
      const parentID = userHierarchy?.config?.parent;

      if (parentID) {
        const parentHierarchys = await getUserHierarchysDao({
          user_id: parentID,
        });
        const parentHierarchy = parentHierarchys?.[0];
        const subVendors = parentHierarchy?.config?.siblings?.sub_vendors ?? [];
        const userIdFilter = [...new Set([parentID, ...subVendors])];
        filters.bank_id = await fetchBankIds(userIdFilter);
      }
    }

    const data = await getBankResponseDaoAll(
      filters,
      page,
      limit,
      filterColumns,
      updated,
      sortBy,
      sortOrder || 'DESC',
      payload.startDate || undefined,
      payload.endDate || undefined,
    );
    return data;
  } catch (error) {
    logger.error('Error in getBankResponseService:', error);
    throw error;
  }
};

const getBankResponseBySearchService = async (
  payload,
  role,
  page,
  limit,
  // search,
  updated,
  sortBy,
  sortOrder,
  designation,
  user_id,
) => {
  try {
    // Search/filter requests should behave like full DB scans unless caller explicitly sends dates.
    // Only the plain default listing should get the fallback date window.
    // if (shouldApplyDefaultBankResponseDateWindow(payload)) {
    //   payload = applyDefaultBankResponseDateWindow(payload);
    // }
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.BANK_RESPONSE
        : role === Role.VENDOR || role === Role.SUB_VENDOR
          ? vendorColumns.BANK_RESPONSE
          : columns.BANK_RESPONSE;

    const sno = Number(payload.sno) > 0 ? Number(payload.sno) : undefined;
    const amount =
      Number(payload.amount) > 0 ? Number(payload.amount) : undefined;

    let filters = Object.fromEntries(
      Object.entries({
        sno,
        status: payload.status || undefined,
        amount,
        utr: payload.utr || undefined,
        bank_id: payload.bank_id || undefined,
        nick_name: payload.nick_name || undefined,
        is_used: payload.is_used || undefined,
        company_id: payload.company_id || undefined,
        upi_short_code: payload.upi_short_code || undefined,
        updated_by: payload.updated_by || undefined,
        updated_at: payload.updated_at || undefined,
      }).filter(([, v]) => v !== undefined),
    );
    sortBy = sortBy ? sortBy : updated ? 'updated_at' : 'sno';

    // Optimized: Use lightweight query for bank IDs only
    const fetchBankIds = async (user_ids) => {
      try {
        return await getBankIdsOnlyDao(user_ids, 'PayIn');
      } catch (error) {
        logger.error('Error fetching PayIn bank IDs:', error);
        return [];
      }
    };

    // Optimized: Skip bank_id fetching if already provided
    if (!filters.bank_id) {
      if (designation === Role.VENDOR || designation === Role.VENDOR_ADMIN) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        const userHierarchy = userHierarchys?.[0];

        const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];
        const vendorUserIds =
          Array.isArray(subVendors) && subVendors.length > 0
            ? [user_id, ...subVendors]
            : [user_id];
        filters.bank_id = await fetchBankIds(vendorUserIds);
      } else if (designation === Role.SUB_VENDOR) {
        filters.bank_id = await fetchBankIds(user_id);
      } else if (designation === Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        const userHierarchy = userHierarchys?.[0];
        const parentID = userHierarchy?.config?.parent;

        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentID,
          });
          const parentHierarchy = parentHierarchys?.[0];
          const subVendors =
            parentHierarchy?.config?.siblings?.sub_vendors ?? [];
          const userIdFilter = [...new Set([parentID, ...subVendors])];
          filters.bank_id = await fetchBankIds(userIdFilter);
        }
      }
    }

    const data = await getBankResponseBySearchDao(
      filters,
      page,
      limit,
      filterColumns,
      updated,
      sortBy,
      sortOrder || 'DESC',
      payload.startDate || undefined,
      payload.endDate || undefined
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching Payin by search', error);
    throw error;
  }
};
const _updateBankResponseServiceInternal = async (
  id,
  payload,
  role,
  conn = null,
) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.BANK_RESPONSE
        : role === Role.VENDOR || role === Role.SUB_VENDOR
          ? vendorColumns.BANK_RESPONSE
          : columns.BANK_RESPONSE;
    const data = await updateBankResponseDao(id, payload, conn);
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('error in _updateBankResponseServiceInternal', error);
    throw error;
  }
};

const updateBankResponseService = async (id, payload, role) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    await applyBankResponseTxTimeouts(conn);
    const finalResult = await _updateBankResponseServiceInternal(
      id,
      payload,
      role,
      conn,
    );
    await commit(conn);
    committed = true;
    return finalResult;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn); // Rollback the transaction in case of error
    }
    logger.error('Error while updating BankResponse', error);
    throw error;
  } finally {
    if (conn) conn.release();
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
        : role === Role.VENDOR || role === Role.SUB_VENDOR
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
    logger.error('Error while getting BankResponse', error);
    throw error;
  }
};

const _resetBankResponseServiceInternal = async (id, userData, conn = null) => {
  try {
    const { company_id, user_name, user_id, role, amount, utr, bank_id } =
      userData;

    // Fetch bank response
    const botRes = await getBankResponseDao(
      { id, company_id },
      null,
      null,
      null,
      null,
      null,
      conn,
    );
    if (!botRes) {
      logger.error(`Bank response not found for ID: ${id}`);
      throw new NotFoundError('Bank response not found');
    }

    // Check for successful pay-in
    let payInData = await getPayInsForResetBankResDao(
      {
        user_submitted_utr: botRes.utr,
        company_id,
      },
      conn,
    );
    if (!payInData?.length) {
      payInData = await getPayInsForResetBankResDao(
        {
          bank_response_id: botRes.id,
          company_id,
        },
        conn,
      );
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

    const changes = {
      amount: botRes.amount,
      utr: botRes.utr,
      bank_id: botRes.bank_id,
      config: botRes.config || {},
      bank_name: (
        await getBankaccountDao(
          { id: botRes.bank_id },
          null,
          null,
          null,
          null,
          null,
          conn,
        )
      )[0]?.nick_name,
    };

    // Prepare base update data
    let updateData = {
      is_used: false,
      updated_by: user_name,
      config: botRes.config || {},
    };

    // Handle specific updates based on input
    let message = 'Bot response reset successful';
    if (typeof amount === 'number' && !isNaN(amount)) {
      const result = await handleAmountUpdate({
        botRes,
        amount,
        user_name,
        company_id,
        role,
        payInData,
        conn,
      });
      updateData = result.updateData;
      changes.config.previousAmount = botRes.amount;
      changes.amount = amount;
      message = result.message;
    }

    if (utr) {
      const bot = await getBankResponseDao({ utr: utr, company_id });
      if (bot) {
        logger.error(`Bank response found: ${utr}`);
        throw new NotFoundError(
          'This UTR has already been used. Please provide a new one.',
        );
      }
      const utrResult = await handleUtrUpdate({
        botRes,
        utr,
        user_id,
        user_name,
        company_id,
        conn,
      });
      updateData = utrResult;
      changes.utr = utr;
      changes.config.previousUTR = botRes.utr;
    }

    if (bank_id) {
      const newBank = await getBankaccountDao({ id: bank_id }, null, null, null, null, conn);
      const bankResult = await handleBankIdUpdate({
        botRes,
        bank_id,
        company_id,
        user_id,
        user_name,
        conn,
      });
      updateData = bankResult;
      changes.bank_id = bank_id;
      changes.nick_name = newBank[0]?.nick_name;
      changes.config.previousBank = (
        await getBankaccountDao({ id: botRes.bank_id }, null, null, null, null, conn)
      )[0]?.nick_name;
    }

    if (!amount && !utr && !bank_id) {
      await updatePayInData({ payInData, user_name, botRes }, conn);
      await resetBankResponseDao(id, updateData, conn);
    }

    // logger.info(`Bank response reset successful for ID: ${id}`, 'info');
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: company_id,
    //   message: `The entry with UTR ${botRes.utr} has been updated.`,
    //   payloadUserId: user_id,
    //   actorUserId: user_id,
    //   category: 'Data Entries',
    // });

    const results = {
      message,
      id,
      data: changes,
      updated_by: user_name,
      updated_at: new Date().toISOString(),
      company_id: company_id,
    };
    await emitTableEntryAsync(tableName.BANK_RESPONSE, results);
    // Only emit PAYIN socket if a payin was actually updated and all required data is available
    if (typeof amount === 'number' && !isNaN(amount) && payInData?.length) {
      // Re-fetch updated payin and related data
      const updatePayInDataRes = payInData[0];
      const merchantData = await getMerchantsBankResponseDao({ id: updatePayInDataRes.merchant_id }, conn);
      const bankDetails = await getBankaccountDao({ id: updatePayInDataRes.bank_acc_id }, null, null, null, null, null, conn);
      const vendorData = await getVendorsBankReponseDao({ user_id: bankDetails[0]?.user_id }, conn);
      const obj = {
        id: updatePayInDataRes.id,
        status: updatePayInDataRes.status,
        company_id: updatePayInDataRes.company_id,
        merchant_order_id: updatePayInDataRes.merchant_order_id,
        amount: updatePayInDataRes.amount || 0,
        merchant_id: merchantData[0]?.merchant_id || null,
        payin_merchant_commission: updatePayInDataRes.payin_merchant_commission || 0,
        payin_vendor_commission: updatePayInDataRes.payin_vendor_commission || 0,
        duration: updatePayInDataRes.duration || 0,
        created_at: updatePayInDataRes.created_at,
        updated_at: updatePayInDataRes.updated_at,
        user_submitted_utr: updatePayInDataRes.user_submitted_utr || null,
        bank_acc_id: updatePayInDataRes.bank_acc_id || null,
        bank_response_id: updatePayInDataRes.bank_response_id || null,
        nick_name: bankDetails[0]?.nick_name || '',
        user: updatePayInDataRes.user || null,
        vendor_code: vendorData[0]?.code || null,
        vendor_user_id: vendorData[0]?.user_id || null,
        config: updatePayInDataRes.config || {},
        merchant_details: {
          merchant_code: merchantData[0]?.code || '',
          dispute: updatePayInDataRes.status === Status.DISPUTE,
          return_url: updatePayInDataRes.config?.urls?.return || null,
          notify_url: updatePayInDataRes.config?.urls?.notify || null,
        },
        bank_res_details: {
          utr: botRes.utr || null,
          amount: botRes.amount || 0,
        },
      };
      await emitTableEntryAsync(tableName.PAYIN, obj);
    }
    return results;
  } catch (error) {
    logger.error('error in _resetBankResponseServiceInternal', error);
    throw error;
  }
};

const resetBankResponseService = async (id, userData) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    await applyBankResponseTxTimeouts(conn);
    const results = await _resetBankResponseServiceInternal(id, userData, conn);
    await commit(conn);
    committed = true;
    return results;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error(`Error resetting bank response for ID: ${id}`, error.message);
    throw error;
  } finally {
    if (conn) conn.release();
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
      is_used: false,
      amount,
    };

    if (amount !== previousAmount) {
      const bankDetails = await getBankaccountDao(
        { id: botRes.bank_id, company_id: botRes.company_id },
        null,
        null,
        null,
        null,
        null,
        conn,
      );
      if (!bankDetails[0]) throw new NotFoundError('Bank account not found');

      const bank = bankDetails[0];
      const vendor = await getVendorsDao(
        { user_id: bank.user_id },
        1,
        10,
        'created_at',
        'DESC',
        null,
        false,
        conn,
      );
      if (!vendor[0]) throw new NotFoundError('Vendor not found');

      const updatedAmount =
        botRes.amount > amount
          ? `-${Math.abs(botRes.amount - amount)}`
          : `+${Math.abs(amount - botRes.amount)}`;

      const payinCommission = calculateCommission(
        updatedAmount,
        vendor[0].payin_commission,
      );

      // Handle sub-vendor and parent commission logic for amount updates
      let totalVendorCommission = payinCommission;
      let parentCommission = 0;

      const subVendorParentInfo = await getSubVendorParentInfo(vendor[0], conn);
      if (subVendorParentInfo) {
        // Calculate parent commission for amount difference
        const baseParentCommission = calculateCommission(
          Math.abs(updatedAmount),
          Number(vendor[0].config?.mediator_payin_commission || 0),
        );
        parentCommission =
          updatedAmount > 0 ? baseParentCommission : -baseParentCommission;

        totalVendorCommission = payinCommission + parentCommission;

        logger.info(
          `Amount update in bankResponse - Sub-vendor commission calculated: sub=${payinCommission}, parent=${parentCommission}, total=${totalVendorCommission}, updatedAmount=${updatedAmount}`,
        );
      }

      // Fetch calculation data for vendor and parent (if sub-vendor)
      let fetchPromises = [getAllCalculationforCronDao(vendor[0].user_id, conn)];
      if (subVendorParentInfo) {
        fetchPromises.push(
          getAllCalculationforCronDao(subVendorParentInfo.parentUserId, conn),
        );
      }

      const calculationResults = await Promise.all(fetchPromises);
      const [vendorCalculationData, parentCalculationData] = calculationResults;

      if (!vendorCalculationData[0]) {
        throw new NotFoundError('Calculation data not found');
      }

      if (subVendorParentInfo && !parentCalculationData[0]) {
        throw new NotFoundError('Parent calculation data not found');
      }

      const approvedDate = getDateWithoutTime(botRes.created_at);
      const vendorCurrentCalculations = vendorCalculationData.filter(
        (calc) => approvedDate === getDateWithoutTime(calc.created_at),
      );
      const vendorCalculations = vendorCalculationData.filter(
        (calc) => approvedDate < getDateWithoutTime(calc.created_at),
      );

      if (!vendorCurrentCalculations[0]) {
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

      // Prepare update promises
      let updatePromises = [
        updateCalculationBalances(
          vendorCurrentCalculations,
          vendorCalculations,
          updatedAmount,
          payinCommission, // Only vendor commission, not total
        ),
      ];

      // Add parent calculation updates if sub-vendor
      if (subVendorParentInfo && parentCurrentCalculations.length > 0) {
        updatePromises.push(
          updateCalculationBalances(
            parentCurrentCalculations,
            parentCalculations,
            0, // Parent vendor amount is always 0 for adjustments
            parentCommission,
          ),
        );
      }

      // Add other updates to the promises array
      updatePromises.push(
        updateBankaccountDao(
          { id: bank.id, company_id: bank.company_id },
          {
            balance: parseFloat(bank.balance) + parseFloat(updatedAmount),
            today_balance:
              parseFloat(bank.today_balance) + parseFloat(updatedAmount),
          },
          conn,
        ).then((res) => {
          if (res.is_enabled) {
            _updateBankaccountInternal(
              { id: bank.id, company_id: res.company_id },
              { latest_balance: res.today_balance },
              role,
              conn,
            );
          }
        }),
        updatePayInData({ payInData, user_name, botRes }, conn),
        updateBotResponseDao(botRes.id, updateData, conn),
      );

      // Execute all updates
      await Promise.all(updatePromises);
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
const handleUtrUpdate = async ({
  botRes,
  utr,
  user_id,
  user_name,
  company_id,
  conn,
}) => {
  try {
    const previousUTR = botRes.utr;
    const previousUpdater = botRes.updated_by;
    const updateData = {
      utr: utr,
      updated_by: user_name,
      config: { ...(botRes.config || {}), previousUTR, previousUpdater },
    };
    const payIn = await getPayInsForResetBankResDao({
      user_submitted_utr: utr,
      company_id,
    }, conn);
    if (
      payIn?.length &&
      payIn[0].user_submitted_utr &&
      ![Status.SUCCESS, Status.FAILED].includes(payIn[0].status)
    ) {
      await updatePayInUrlDao(
        payIn[0].id,
        {
          user_submitted_utr: utr,
          updated_by: user_id,
        },
        conn,
      );
      // Socket event handled by caller or omitted for partial update
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
      getBankaccountDao(
        { id: botRes.bank_id },
        null,
        null,
        null,
        null,
        null,
        conn,
      ),
      getBankaccountDao({ id: bank_id }, null, null, null, null, null, conn),
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
      getVendorsDao(
        { user_id: prevBank[0].user_id },
        1,
        10,
        'created_at',
        'DESC',
        null,
        false,
        conn,
      ),
      getVendorsDao(
        { user_id: newBank[0].user_id },
        1,
        10,
        'created_at',
        'DESC',
        null,
        false,
        conn,
      ),
    ]);
    if (!prevVendor[0] || !newVendor[0])
      throw new NotFoundError('Vendor not found');

    const [prevVendorCalc, newVendorCalc] = await Promise.all([
      getAllCalculationforCronDao(prevVendor[0].user_id, conn),
      getAllCalculationforCronDao(newVendor[0].user_id, conn),
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

    // Handle sub-vendor logic for both previous and new vendors
    let totalPrevVendorCommission = prevVendorCommission;
    let totalNewVendorCommission = newVendorCommission;

    // Check if previous vendor is sub-vendor
    const prevSubVendorParentInfo = await getSubVendorParentInfo(
      prevVendor[0],
      conn,
    );
    let prevParentCommission = 0;
    let prevParentCalculationData = null;
    let prevParentCurrentCalcs = [];
    let prevParentNextCalcs = [];

    if (prevSubVendorParentInfo) {
      prevParentCommission = calculateCommission(
        Math.abs(botRes.amount),
        Number(prevVendor[0].config?.mediator_payin_commission || 0),
      );
      totalPrevVendorCommission = prevVendorCommission + prevParentCommission;

      // Fetch parent calculation data for proper adjustment handling
      prevParentCalculationData = await getAllCalculationforCronDao(
        prevSubVendorParentInfo.parentUserId,
        conn,
      );
      if (prevParentCalculationData[0]) {
        const approvedDate = getDateWithoutTime(botRes.created_at);
        prevParentCurrentCalcs = prevParentCalculationData.filter(
          (calc) => approvedDate === getDateWithoutTime(calc.created_at),
        );
        prevParentNextCalcs = prevParentCalculationData.filter(
          (calc) => approvedDate < getDateWithoutTime(calc.created_at),
        );
      }

      logger.info(
        `Bank ID update - Previous vendor sub-vendor commission reversed: sub=${-prevVendorCommission}, parent=${-prevParentCommission}, total=${-totalPrevVendorCommission}`,
      );
    }

    // Check if new vendor is sub-vendor
    const newSubVendorParentInfo = await getSubVendorParentInfo(
      newVendor[0],
      conn,
    );
    let newParentCommission = 0;
    let newParentCalculationData = null;
    let newParentCurrentCalcs = [];
    let newParentNextCalcs = [];

    if (newSubVendorParentInfo) {
      newParentCommission = calculateCommission(
        Math.abs(botRes.amount),
        Number(newVendor[0].config?.mediator_payin_commission || 0),
      );
      totalNewVendorCommission = newVendorCommission + newParentCommission;

      // Fetch parent calculation data for proper adjustment handling
      newParentCalculationData = await getAllCalculationforCronDao(
        newSubVendorParentInfo.parentUserId,
        conn,
      );
      if (newParentCalculationData[0]) {
        const approvedDate = getDateWithoutTime(botRes.created_at);
        newParentCurrentCalcs = newParentCalculationData.filter(
          (calc) => approvedDate === getDateWithoutTime(calc.created_at),
        );
        newParentNextCalcs = newParentCalculationData.filter(
          (calc) => approvedDate < getDateWithoutTime(calc.created_at),
        );
      }

      logger.info(
        `Bank ID update - New vendor sub-vendor commission calculated: sub=${newVendorCommission}, parent=${newParentCommission}, total=${totalNewVendorCommission}`,
      );
    }

    // Prepare all calculation update promises
    let calculationUpdatePromises = [
      updateCalculationBalances(
        prevVendorCurrentCalcs,
        prevVendorNextCurrentCalcs,
        -botRes.amount,
        -prevVendorCommission, // Only vendor commission, not total
        -1,
      ),
      updateCalculationBalances(
        newVendorCurrentCalcs,
        newVendorNextCurrentCalcs,
        botRes.amount,
        newVendorCommission, // Only vendor commission, not total
        1,
      ),
    ];

    // Add parent calculation updates for bank change scenario
    if (prevSubVendorParentInfo && prevParentCurrentCalcs.length > 0) {
      calculationUpdatePromises.push(
        updateCalculationBalances(
          prevParentCurrentCalcs,
          prevParentNextCalcs,
          0, // Parent vendor amount is always 0
          -prevParentCommission, // Reverse the commission
          -1,
        ),
      );
    }

    if (newSubVendorParentInfo && newParentCurrentCalcs.length > 0) {
      calculationUpdatePromises.push(
        updateCalculationBalances(
          newParentCurrentCalcs,
          newParentNextCalcs,
          0, // Parent vendor amount is always 0
          newParentCommission, // Add the commission
          1,
        ),
      );
    }

    // Prepare all other update promises
    // Using atomic increment/decrement to prevent race conditions on concurrent updates
    let otherUpdatePromises = [
      atomicDecrementBankBalanceDao(
        { id: prevBank[0].id, company_id },
        parseFloat(botRes.amount),
        user_id,
        conn,
      ),
      atomicUpdateBankBalanceDao(
        { id: newBank[0].id, company_id },
        parseFloat(botRes.amount),
        user_id,
        conn,
      ),
      updateBotResponseDao(botRes.id, updateData, conn),
    ];

    // Execute all updates
    await Promise.all([...calculationUpdatePromises, ...otherUpdatePromises]);
  } catch (error) {
    logger.error('Error in handle bank id update:', error.message);
    throw error;
  }
};

// Update pay-in data
const updatePayInData = async ({ payInData, user_name, botRes }, conn) => {
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
          item.user_submitted_utr === botRes.utr &&
          item.status !== Status.FAILED,
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
          new Date().getTime() -
            new Date(updatePayinID[0].created_at).getTime() <
          10 * 60 * 1000
            ? Status.ASSIGNED
            : Status.DROPPED,
        user_submitted_utr: null,
        bank_response_id: null,
        updated_by: user_name,
      };
      await updatePayInUrlDao(updatePayinID[0].id, updatePayinData, conn);
      // Socket event handled by caller or omitted for partial update
    }
  } catch (error) {
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

    return creditedTransactions;
  } catch (error) {
    logger.error('Error in extractCreditedTransactions:', error);
    throw error;
  }
}

// Main service function
const _importBankResponseServiceInternal = async (
  payload,
  companyId,
  role,
  name,
) => {
  try {
    // Validate payload
    if (!payload || !payload.pdfBuffer) {
      throw new BadRequestError('No valid PDF buffer provided in payload');
    }

    // Extract credited transactions
    const creditedTransactions = await extractCreditedTransactions(
      payload.pdfBuffer,
      payload.bank_id,
    );

    // Note: Each createBankResponseService manages its own transaction
    for (const transaction of creditedTransactions) {
      await createBankResponseService(transaction, companyId, role, name);
    }

    return {
      message: `${payload.fileType} imported successfully`,
    };
  } catch (error) {
    logger.error('error in _importBankResponseServiceInternal', error);
    throw error;
  }
};

const importBankResponseService = async (payload, companyId, role, name) => {
  try {
    // Note: Transaction management happens within each createBankResponseService call
    const result = await _importBankResponseServiceInternal(
      payload,
      companyId,
      role,
      name,
    );
    return result;
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
  count = 0,
) => {
  try {
    if (!currentCalculation) return;
    const updates = {
      total_payin_count: count,
      total_payin_commission: commission,
      total_payin_amount: amountDiff,
      current_balance: amountDiff - commission,
      net_balance: amountDiff - commission,
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
        );

        await trackVendorsNetBalance(calc.user_id, updatedCalc);
      }
    }
  } catch (error) {
    logger.error('Error in updateCalculationBalances:', error);
    throw error;
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
  createBankResponseWebHookService,
};
