import { BadRequestError, InternalServerError, NotFoundError } from '../../utils/appErrors.js';

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
import { getVendorsDao } from '../vendors/vendorDao.js';
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { getCalculationforCronDao, updateCalculationBalanceDao } from '../calculation/calculationDao.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { filterResponse } from '../../helpers/index.js';

const createBankResponseService = async (conn, payload, companyId, role, name) => {
  const filterColumns =
    role === Role.MERCHANT
      ? merchantColumns.BANK_RESPONSE
      : role === Role.VENDOR
        ? vendorColumns.BANK_RESPONSE
        : columns.BANK_RESPONSE;

  let amount, upi_short_code, utr, bank_id, from_UI;
  const splitData = payload.split(' ');

  amount = parseFloat(splitData[0]);
  upi_short_code = splitData.length > 1 ? splitData[1] : "";
  utr = splitData[2];
  bank_id = splitData[3];
  from_UI = splitData[4];

  // UTR validation when from_UI is true
  if (from_UI) {
    // Check if multiple UTRs are allowed (contains valid separators)
    const validSeparators = [',', ';', '|'];
    const hasSeparators = validSeparators.some(sep => utr.includes(sep));

    if (hasSeparators) {
      // Split UTRs by any valid separator and validate each
      const utrArray = utr.split(/[,;|]/).map(u => u.trim()).filter(u => u);
      const invalidUtr = utrArray.some(u => !/^[a-zA-Z0-9]+$/.test(u));

      if (invalidUtr) {
        throw new Error('UTRs can only contain alphanumeric characters.');
      }
    } else {
      // Single UTR: allow only alphanumeric, no special characters
      if (!/^[a-zA-Z0-9]+$/.test(utr)) {
        throw new Error('UTR can only contain alphanumeric characters.');
      }
    }
  }

  const created_by = name ? name : 'Bank Response';
  const updated_by = name ? name : 'Bank Response';
  const company_id = companyId;
  const isValidAmount = amount > 1 && amount < 500000;
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
        let botUtrIsUsed
        if (getDataByUtr.rows.length > 1) {
          botUtrIsUsed = getDataByUtr?.some((item) => item.is_used); //isused- true and bankresponse entry and payin status - pending , assigned , initiated, dropped
        }
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
                    user_submitted_utr: botRes?.utr,
                    approved_at: new Date(),
                    duration: duration,
                    payin_merchant_commission: payinMerchantCommission,
                    payin_vendor_commission: payinVendorCommission,
                    config: { from_UI: from_UI },
                    bank_response_id: botRes.id
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
                  //  userId pass always in updateCalculationTable
                  await updateCalculationTable(merchatnData.user_id, {
                    payinMerchantCommission,
                    amount: botRes.amount,
                  });
                  await updateCalculationTable(
                    botRes.user_id,
                    {
                      payinCommission: payinVendorCommission,
                      amount: botRes.amount,
                    },
                    conn,
                  );
                  return { message: `Successfully Created The Entry` }
                } else {
                  return { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr[0]?.user_submitted_utr}` };
                }
              } else {
                const payInData = {
                  status: 'SUCCESS',
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  approved_at: new Date(),
                  duration: duration,
                  payin_merchant_commission: payinMerchantCommission,
                  payin_vendor_commission: payinVendorCommission,
                  config: { from_UI: from_UI },
                  bank_response_id: botRes.id
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
                //  userId pass always in updateCalculationTable
                await updateCalculationTable(merchatnData.user_id, {
                  payinMerchantCommission,
                  amount: botRes.amount,
                });
                await updateCalculationTable(
                  botRes.user_id,
                  {
                    payinCommission: payinVendorCommission,
                    amount: botRes.amount,
                  },
                  conn,
                );
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
                user_submitted_utr: botRes?.utr,
                approved_at: new Date(),
                duration: duration,
                payin_merchant_commission: payinMerchantCommission,
                payin_vendor_commission: payinVendorCommission,
                config: { from_UI: from_UI },
                bank_response_id: botRes.id
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
                await updateCalculationTable(
                  bankdetails[0]?.user_id,
                  {
                    payinCommission: payinVendorCommission,
                    amount: botRes.amount,
                  },
                  conn,
                );
              }
              await updateBotResponseDao(botRes.id, { is_used: true }, conn);

              const merchatnData = await getMerchantsDao({
                id: checkPayInUtr[0]?.merchant_id,
              }, null, null, null, null);
              if (!merchatnData) {
                return { message: `No Entry found in Bank Response table with ${botRes.id}` }
              }
              await updateMerchantDao({ id: checkPayInUtr[0]?.merchant_id }, {
                balance: merchatnData[0].balance + parseFloat(amount),
              }, conn);
              //  userId pass always in updateCalculationTable
              await updateCalculationTable(merchatnData[0].user_id, {
                payinCommission: payinMerchantCommission,
                amount: botRes.amount,
              });
              return { message: `Successfully Created The Entry` }
            } else {
              return { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr[0]?.user_submitted_utr}` };
            }
          } else {
            const payInData = {
              status: 'SUCCESS',
              is_notified: true,
              user_submitted_utr: botRes?.utr,
              approved_at: new Date(),
              duration: duration,
              payin_merchant_commission: payinMerchantCommission,
              payin_vendor_commission: payinVendorCommission,
              config: { from_UI: from_UI },
              bank_response_id: botRes.id
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
            //  userId pass always in updateCalculationTable
            await updateCalculationTable(merchatnData.user_id, {
              payinMerchantCommission,
              amount: botRes.amount,
            });
            await updateCalculationTable(
              botRes.user_id,
              {
                payinCommission: payinVendorCommission,
                amount: botRes.amount,
              },
              conn,
            );
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

const updateCalculationTable = async (user_id, data, conn) => {
  if (user_id) {
    const calculationData = await getCalculationforCronDao(user_id);
    if (!calculationData[0]) {
      throw new NotFoundError('Calculation not found!');
    }
    let count = calculationData[0].total_settlement_count + 1;
    let amountCalculation =
      calculationData[0].total_payin_amount + data?.amount;
    let currentBalance = Number(calculationData[0].current_balance) || 0 + data?.amount;
    let netBalance = calculationData[0].net_balance + data?.amount;
    const calculationId = calculationData[0].id;
    await updateCalculationBalanceDao(
      { id: calculationId },
      {
        total_payin_count: count,
        total_payin_amount: amountCalculation,
        total_payin_commission: data.payinCommission,
        current_balance: currentBalance,
        net_balance: netBalance,
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
    const amount = Number(payload.amount) > 0 ? Number(payload.amount) : undefined;
    const is_used = payload.is_used === 'Used' ? true : payload.is_used === 'Unused' ? false : undefined;

    let filters = Object.fromEntries(
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
    filters = {
      ...(search ? { search } : {}),
      ...filters,
    }
    return await getBankResponseDaoAll(filters, page, limit, null, null, filterColumns);
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
  updateBankResponseService,
  getBankMessageServices,
  getBankResponseBySearchService,
  resetBankResponseService,
};
