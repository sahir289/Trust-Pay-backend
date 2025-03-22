import { BadRequestError } from '../../utils/appErrors.js';

import {
  getBankResponseDao,
  createBankResponseDao,
  getBankMessageDao,
  resetBankResponseDao,
  updateBotResponseDao,
  getBankResponseDaoAll,
} from './bankResponseDao.js';
import Logger from '../../utils/logger.js';
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
import { getVendorsDao } from '../vendors/vendorDao.js';
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
const logger = new Logger();

const createBankResponseService = async (conn, payload, companyId, role, name) => {
  const filterColumns =
    role === Role.MERCHANT
      ? merchantColumns.BANK_RESPONSE
      : role === Role.VENDOR
        ? vendorColumns.BANK_RESPONSE
        : columns.BANK_RESPONSE;

  let amount, upi_short_code, utr, bank_id, from_UI
  const splitData = payload.split(' ');
  amount = parseFloat(splitData[0]);
  upi_short_code = splitData.length > 1 ? splitData[1] : "";
  utr = splitData[2];
  bank_id = splitData[3];
  from_UI = splitData[4];

  const created_by = name ? name : 'Bank Response';
  const updated_by = name ? name : 'Bank Response';
  const company_id = companyId;
  const isValidAmount = amount;

  let isValidAmountCode
  if (upi_short_code) {
    isValidAmountCode =
      upi_short_code !== 'nil' && upi_short_code.length === 5;
  }
  const acceptedStatus = [
    'SUCCESS',
    'DISPUTE',
    'BANK_MISMATCH',
    'FAILED',
    'DUPLICATE',
  ];

  if (isValidAmount) {
    const utrAlreadyExist = await getBankResponseDao(
      { utr: utr, company_id: company_id },
      null,
      null,
      null,
      null,
      filterColumns
    );
    const updatedData = {
      status: utrAlreadyExist ? '/repeated' : '/success',
      amount,
      utr,
      bank_id,
      config: { from_UI: from_UI },
      is_used: 'false',
      created_by,
      updated_by,
      company_id,
    };

    if (isValidAmountCode) {
      updatedData.upi_short_code = upi_short_code;
    }

    const isAmountCodeExist = await getBankResponseDao(
      { upi_short_code: upi_short_code, company_id: company_id },
      null,
      null,
      null,
      null,
      filterColumns,
    );

    if (isAmountCodeExist) {
      // const botRes =
      await getBankResponseDao(
        {
          status: updatedData.status,
          amount: updatedData.amount,
          utr: updatedData.utr,
          bank_id: updatedData.bank_id,
          is_used: updatedData.is_used,
          created_by: updatedData.created_by,
          company_id: updatedData.company_id,
        },
        null,
        null,
        null,
        null,
        filterColumns,
      );
      return { message: 'Amount code already exist' };
    }

    let botRes;
    const utrinternalTransfer = await getSettlementDaoforInternalTransfer(
      utr,
      ['INTERNAL_QR_TRANSFER', 'INTERNAL_BANK_TRANSFER'],
    );

    if (utrinternalTransfer) {
      const updatedData = {
        status: '/internalTransfer',
        amount: amount,
        utr: utr,
        bank_id: bank_id,
        is_used: false,
        created_by: created_by,
        company_id: company_id,
        config: { from_UI: from_UI }
      };
      botRes = await createBankResponseDao(conn, updatedData);
    } else {
      botRes = await createBankResponseDao(conn, updatedData);
    }

    if (updatedData.status === '/repeated') {
      return {
        message: `Entry with REPEATED UTR Added ${updatedData.utr}`,
      };
    }

    const checkPayInUtr = await getPayInUrlsDao({ user_submitted_utr: utr });
    if (checkPayInUtr?.length > 0) {
      if (upi_short_code && isValidAmountCode) {
        const getDataByUtr = await getBankResponseDaoAll(
          { utr: checkPayInUtr[0]?.user_submitted_utr, company_id: company_id },
          null,
          null,
          null,
          null,
          filterColumns,
        );
        const botUtrIsUsed = getDataByUtr?.some((item) => item.is_used); //isused- true and bankresponse entry and payin status - pending , assigned , initiated, dropped
        if (
          !acceptedStatus.includes(checkPayInUtr[0]?.status) &&
          botUtrIsUsed
        ) {
          return {
            message: `The entry is already ${checkPayInUtr[0]?.status} with UTR`,
          }
        } else {
          if (!botUtrIsUsed) {
            // We check bank exist here as we have to add the data to the res no matter what comes.
            const isBankExist = await getBankaccountDao({ id: bank_id, company_id: companyId }, null, null, role);
            if (checkPayInUtr[0].bank_acc_id !== isBankExist?.id) {
              if (checkPayInUtr[0]?.user_submitted_utr) {
                if (checkPayInUtr[0]?.user_submitted_utr == utr) {
                  const payInData = {
                    status: 'BANK_MISMATCH',
                    is_notified: true,
                    user_submitted_utr: botRes?.utr,
                    bank_response_id: botRes?.id,
                    approved_at: new Date(),
                    config: { from_UI: from_UI },

                  };
                  const updatePayInDataRes =
                    await updatePayInUrlDao(
                      checkPayInUtr[0]?.id,
                      payInData,
                      conn,
                    );
                  await updateBotResponseDao(botRes.id, { is_used: true }, conn);

                  return { message: `Bank Mismatch with ${updatePayInDataRes?.merchant_order_id}` };
                } else {
                  return { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr[0]?.user_submitted_utr}` };
                }
              } else {
                const payInData = {
                  status: 'BANK_MISMATCH',
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  bank_response_id: botRes?.id,
                  approved_at: new Date(),
                  config: { from_UI: from_UI },
                };

                const updatePayInDataRes = await updatePayInUrlDao(
                  checkPayInUtr[0]?.id,
                  payInData,
                  conn,
                );

                 await updateBotResponseDao(botRes.id, { is_used: true }, conn);

                return { message: `entry in bank mismatch with ${updatePayInDataRes?.merchant_order_id}` };
              }
            }
            const existingResponse = await getBankResponseDao(
              {
                utr: utr,
                is_used: true,
                company_id: company_id,
              },
              null,
              null,
              null,
              null,
              filterColumns,
            );
            if (existingResponse?.length > 0) {
              return {
                message: `The UTR already exists`,
              };
            }
            const getMerchantToGetPayinCommissionRes = await getMerchantsDao({
              id: checkPayInUtr[0]?.merchant_id,
            }, null, null, null, null);

            const payinMerchantCommission = calculateCommission(
              botRes?.amount,
              getMerchantToGetPayinCommissionRes?.payin_commission,
            );
            const bankAccountDetails = await getBankaccountDao({
              id: checkPayInUtr[0].bank_acc_id, company_id: companyId
            }, null, null, role);

            const getVendorToGetPayinComission = await getVendorsDao({
              user_id: bankAccountDetails[0].user_id,
            }, null, null, null, null);

            const payinVendorCommission = calculateCommission(
              Number(botRes?.amount),
              Number(getVendorToGetPayinComission[0]?.payin_commission),
            );
            const durMs = new Date() - checkPayInUtr[0]?.created_at;
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

            if (checkPayInUtr[0]?.amount == amount) {
              if (checkPayInUtr[0]?.user_submitted_utr) {
                if (checkPayInUtr[0]?.user_submitted_utr == utr) {
                  const payInData = {
                    status: 'SUCCESS',
                    is_notified: true,
                    // is_used: true,
                    user_submitted_utr:botRes?.utr ,
                    approved_at: new Date(),
                    duration: duration,
                    payin_merchant_commission: payinMerchantCommission,
                    payin_vendor_commission: payinVendorCommission,
                    config: { from_UI: from_UI },
                    bank_response_id : botRes.id
                  };

                  await updatePayInUrlDao(
                    checkPayInUtr[0]?.id,
                    payInData,
                    conn
                  );

                  if (checkPayInUtr[0]?.bank_acc_id) {
                    const bankdetails = await getBankaccountDao({
                      id: isBankExist?.id, company_id: companyId
                    }, null, null, role);
                    await updateBankaccountDao(
                      { id: checkPayInUtr[0]?.bank_acc_id },
                      {
                        balance: bankdetails.balance + parseFloat(amount),
                        today_balance:
                          bankdetails.balance + parseFloat(amount),
                      }, conn
                    );
                  }
                   await updateBotResponseDao(botRes.id, { is_used: true }, conn);
                  const merchatnData = await getMerchantsDao({
                    id: checkPayInUtr[0]?.merchant_id,
                  }, null, null, null, null);
                  // const updateMerchantData =
                  await updateMerchantDao({ id: checkPayInUtr[0]?.merchant_id }, {
                    balance: merchatnData.balance + parseFloat(amount),
                  }, conn);
                  return { message: `Successfully Created The Entry` }
                } else {
                  return { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr[0]?.user_submitted_utr}` };
                }
              } else {
                const payInData = {
                  status: 'SUCCESS',
                  is_notified: true,
                  user_submitted_utr:botRes?.utr ,
                  approved_at: new Date(),
                  duration: duration,
                  payin_merchant_commission: payinMerchantCommission,
                  payin_vendor_commission: payinVendorCommission,
                  config: { from_UI: from_UI },
                  bank_response_id : botRes.id
                };

                await updatePayInUrlDao(
                  checkPayInUtr[0]?.id,
                  payInData, conn
                );

                if (checkPayInUtr[0]?.bank_acc_id) {
                  const bankdetails = await getBankaccountDao({
                    id: isBankExist?.id, company_id: companyId
                  }, null, null, role);
                  await updateBankaccountDao({ id: checkPayInUtr[0]?.bank_acc_id }, {
                    balance: bankdetails.balance + parseFloat(amount),
                    today_balance: bankdetails.balance + parseFloat(amount),
                  }, conn);
                }
                 await updateBotResponseDao(botRes.id, { is_used: true }, conn);
                const merchatnData = await getMerchantsDao({
                  id: checkPayInUtr[0]?.merchant_id,
                }, null, null, null, null);
                await updateMerchantDao({ id: checkPayInUtr[0]?.merchant_id }, {
                  balance: merchatnData.balance + parseFloat(amount),
                }, conn);
                return { message: `Successfully Created The Entry` }
              }
            } else {
              if (checkPayInUtr[0]?.user_submitted_utr) {
                if (checkPayInUtr[0]?.user_submitted_utr == utr) {
                  const payInData = {
                    status: 'DISPUTE',
                    is_notified: true,
                    user_submitted_utr: botRes?.utr,
                    bank_response_id: botRes?.id,
                    approved_at: new Date(),
                    duration: duration,
                    payin_merchant_commission: payinMerchantCommission,
                    payin_vendor_commission: payinVendorCommission,
                    config: { from_UI: from_UI },
                  };
                  const updatePayInDataRes = await updatePayInUrlDao(
                    checkPayInUtr[0]?.id,
                    payInData,
                    conn,
                  );

                   await updateBotResponseDao(botRes.id, { is_used: true }, conn);

                  return { message: `Entry is in Dispute with ${updatePayInDataRes?.merchant_order_id}` }
                } else {
                  return { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr[0]?.user_submitted_utr}` };
                }
              } else {
                const payInData = {
                  status: 'DISPUTE',
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  bank_response_id: botRes?.id,
                  approved_at: new Date(),
                  duration: duration,
                  payin_merchant_commission: payinMerchantCommission,
                  payin_vendor_commission: payinVendorCommission,
                  config: { from_UI: from_UI },
                };
                const updatePayInDataRes =
                  await updatePayInUrlDao(
                    checkPayInUtr[0]?.id,
                    payInData,
                    conn,
                  );

                 await updateBotResponseDao(botRes.id, { is_used: true }, conn);
                return { message: `Entry is in DISPUTE with ${updatePayInDataRes[0]?.merchant_order_id}` }
              }
            }
          }
          else {
            const existingResponse = await getBankResponseDao(
              {
                utr: utr,
                is_used: true,
                company_id: company_id,
              },
              null,
              null,
              null,
              null,
              filterColumns,
            );
            if (existingResponse?.length > 0) {
              return {
                message: `The UTR already exists`,
              };
            }
          }
        }
      }
      else {
        if (!acceptedStatus.includes(checkPayInUtr[0]?.status)) {
          const isBankExist = await getBankaccountDao({ id: bank_id, company_id: companyId }, null, null, role);
          if (!isBankExist) {
            if (checkPayInUtr[0]?.user_submitted_utr) {
              if (checkPayInUtr[0]?.user_submitted_utr == utr) {
                const payInData = {
                  status: 'BANK_MISMATCH',
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  bank_response_id: botRes?.id,
                  approved_at: new Date(),
                  config: { from_UI: from_UI },
                };
                const updatePayInDataRes = await updatePayInUrlDao(
                  checkPayInUtr[0]?.id,
                  payInData,
                  conn,
                );

                 await updateBotResponseDao(botRes.id, { is_used: true }, conn);
                return { message: `entry in bank Mismatch with ${updatePayInDataRes?.merchant_order_id}` }
              } else {
                return { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr[0]?.user_submitted_utr}` };
              }
            } else {
              const payInData = {
                status: 'BANK_MISMATCH',
                is_notified: true,
                user_submitted_utr: botRes?.utr,
                bank_response_id: botRes?.id,
                approved_at: new Date(),
                config: { from_UI: from_UI },
              };

              const updatePayInDataRes = await updatePayInUrlDao(
                checkPayInUtr[0]?.id,
                payInData,
                conn,
              );

               await updateBotResponseDao(botRes.id, { is_used: true }, conn);

              return { message: `entry in bank mismatch with ${updatePayInDataRes?.merchant_order_id}` }
            }
          }

          if (checkPayInUtr[0].bank_acc_id !== isBankExist[0].id) {
            if (checkPayInUtr[0]?.user_submitted_utr) {
              if (checkPayInUtr[0]?.user_submitted_utr == utr) {
                const payInData = {
                  status: 'BANK_MISMATCH',
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  bank_response_id: botRes?.id,
                  approved_at: new Date(),
                  config: { from_UI: from_UI },
                };

                const updatePayInDataRes = await updatePayInUrlDao(
                  checkPayInUtr[0]?.id,
                  payInData,
                  conn,
                );
                 await updateBotResponseDao(botRes.id, { is_used: true }, conn);
                return { message: `Bank Mismatch created with ${updatePayInDataRes?.merchant_order_id}` }
              }
            } else {
              return { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr[0]?.user_submitted_utr}` };
            }
          }
        }

        // check if duplicate and return error
        const existingResponse = await getBankResponseDao(
          { utr: utr, is_used: true, company_id: company_id },
          null,
          null,
          null,
          null,
          filterColumns,
        );
        if (existingResponse?.length > 0) {
          return {
            message: `The UTR already exists`,
          };
        }
        console.log("noterepeated")
        const getMerchantToGetPayinCommissionRes = await getMerchantsDao({
          id: checkPayInUtr[0]?.merchant_id,
        }, null, null, null, null);
        const payinMerchantCommission = calculateCommission(
          Number(botRes?.amount),
          Number(getMerchantToGetPayinCommissionRes[0].payin_commission),
        );
        const bankAccountDetails = await getBankaccountDao({
          id: checkPayInUtr[0].bank_acc_id, company_id: companyId
        }, null, null, role);
        const getVendorToGetPayinComission = await getVendorsDao({
          user_id: bankAccountDetails[0].user_id,
        }, null, null, null, null);
        const payinVendorCommission = calculateCommission(
          Number(botRes?.amount),
          Number(getVendorToGetPayinComission[0]?.payin_commission),
        );

        const durMs = new Date() - checkPayInUtr[0]?.created_at;
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

        if (checkPayInUtr[0]?.amount == amount) {
          if (checkPayInUtr[0]?.user_submitted_utr) {
            if (checkPayInUtr[0]?.user_submitted_utr == utr) {
              const payInData = {
                status: 'SUCCESS',
                is_notified: true,
                user_submitted_utr:botRes?.utr ,
                approved_at: new Date(),
                duration: duration,
                payin_merchant_commission: payinMerchantCommission,
                payin_vendor_commission: payinVendorCommission,
                config: { from_UI: from_UI },
                bank_response_id : botRes.id
              };

              await updatePayInUrlDao(
                checkPayInUtr[0]?.id,
                payInData,
                conn,
              );

              if (checkPayInUtr[0]?.bank_acc_id) {
                const bankdetails = await getBankaccountDao({
                  id: checkPayInUtr[0]?.bank_acc_id, company_id: companyId
                }, null, null, role);
                await updateBankaccountDao({ id: checkPayInUtr[0]?.bank_acc_id }, {
                  balance: bankdetails[0].balance + parseFloat(amount),
                  today_balance: bankdetails[0].balance + parseFloat(amount),
                }, conn);
              }
               await updateBotResponseDao(botRes.id, { is_used: true }, conn);

              const merchatnData = await getMerchantsDao({
                id: checkPayInUtr[0]?.merchant_id,
              }, null, null, null, null);
              if (!merchatnData) {
                return { message: `No Entry found in Bank Response table with ${botRes.id}` }
              }
              await updateMerchantDao({ id: checkPayInUtr[0]?.merchant_id }, {
                balance: merchatnData.balance + parseFloat(amount),
              }, conn);
              return { message: `Successfully Created The Entry` }
            } else {
              return { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr[0]?.user_submitted_utr}` };
            }
          } else {
            const payInData = {
              status: 'SUCCESS',
              is_notified: true,
              user_submitted_utr:botRes?.utr ,
              approved_at: new Date(),
              duration: duration,
              payin_merchant_commission: payinMerchantCommission,
              payin_vendor_commission: payinVendorCommission,
              config: { from_UI: from_UI },
              bank_response_id : botRes.id
            };

            const updatePayInDataRes = await updatePayInUrlDao(
              checkPayInUtr[0]?.id,
              payInData,
              conn,
            );

            if (checkPayInUtr[0]?.bank_acc_id) {
              const bankdetails = await getBankaccountDao({
                id: updatePayInDataRes?.bank_acc_id, company_id: companyId
              }, null, null, role);
              await updateBankaccountDao({ id: checkPayInUtr[0]?.bank_acc_id }, {
                balance: bankdetails.balance + parseFloat(amount),
                today_balance: bankdetails.balance + parseFloat(amount),
              }, conn);
            }
             await updateBotResponseDao(botRes.id, { is_used: true }, conn);
            const merchatnData = await getMerchantsDao({
              id: checkPayInUtr[0]?.merchant_id,
            }, null, null, null, null);
            await updateMerchantDao({ id: checkPayInUtr[0]?.merchant_id }, {
              balance: merchatnData.balance + parseFloat(amount),
            }, conn);
            return { message: `Successfully Created The Entry` }
          }
        } else {
          if (checkPayInUtr[0]?.user_submitted_utr) {
            if (checkPayInUtr[0]?.user_submitted_utr == utr) {
              const payInData = {
                status: 'DISPUTE',
                is_notified: true,
                user_submitted_utr: botRes?.utr,
                bank_response_id: botRes?.id,
                approved_at: new Date(),
                duration: duration,
                payin_merchant_commission: payinMerchantCommission,
                payin_vendor_commission: payinVendorCommission,
                config: { from_UI: from_UI },
              };
              await updatePayInUrlDao(
                checkPayInUtr[0]?.id,
                payInData,
                conn
              );

               await updateBotResponseDao(botRes.id, { is_used: true }, conn);
              return { message: `Amount is in DISPUTE with : ${checkPayInUtr[0]?.user_submitted_utr}` }
            } else {
              return { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr[0]?.user_submitted_utr}` };
            }
          } else {
            const payInData = {
              status: 'DISPUTE',
              is_notified: true,
              user_submitted_utr: botRes?.utr,
              bank_response_id: botRes?.id,
              approved_at: new Date(),
              duration: duration,
              payin_merchant_commission: payinMerchantCommission,
              payin_vendor_commission: payinVendorCommission,
              config: { from_UI: from_UI },
            };
            await updatePayInUrlDao(
              checkPayInUtr[0]?.id,
              payInData,
              conn,
            );

            await updateBotResponseDao({ id: botRes?.id }, { is_used: true, config: { from_UI: from_UI } }, conn);
            return { message: `Entry in dispute with ${botRes?.id}` }
          }
        }
      }
    }
    return { message: `Entry created successfully` }
  }
  else {
    return {
      message: 'Invalid data received',
    };
  }
}

const getBankResponseService = async (payload, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.BANK_RESPONSE
        : role === Role.VENDOR
          ? vendorColumns.BANK_RESPONSE
          : columns.BANK_RESPONSE;

    const sno = Number(payload.sno) > 0 ? Number(payload.sno) : undefined;
    const amount = Number(payload.amount) > 0 ? Number(payload.amount) : undefined;
    const is_used = payload.is_used === 'Used' ? true : payload.is_used === 'Unused' ? false : undefined;

    const filters = Object.fromEntries(
      Object.entries({
        sno,
        status: payload.status || undefined,
        amount,
        utr: payload.utr || undefined,
        bank_id: payload.bank_id || undefined,
        is_used,
        company_id: payload.company_id || undefined,
      }).filter(([, v]) => v !== undefined)
    );

    return await getBankResponseDaoAll(filters, null, null, null, null, filterColumns);
  } catch (error) {
    console.error('Error while fetching BankResponse:', error);
    throw new BadRequestError('Error occurred while Fetching BankResponse');
  }
};

const getBankMessageServices = async (
  bank_id,
  startDate,
  endDate,
  company_id,
  role, page, limit
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
      company_id
      , pageNumber, pageSize,
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
  getBankMessageServices,
  resetBankResponseService,
};
