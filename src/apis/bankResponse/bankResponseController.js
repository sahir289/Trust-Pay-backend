import axios from 'axios';
import { columns, merchantColumns, Role, vendorColumns } from '../../constants/index.js';
import {
  CREATE_BANK_RESPONSE_SCHEMA,

  // VALIDATE_BANK_RESPONSE_QUERY,
} from '../../schemas/bankResponseSchema.js';
import { CustomError, InternalServerError, ValidationError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getPayInUrlsDao, updatePayInUrlDao } from '../payIn/payInDao.js';
import { createBankResponseDao, getBankResponseDao, getBankResponseDaoAll, updateBotResponseDao } from './bankResponseDao.js';

import {
  getBankResponseService,
  getBankMessageServices,
} from './bankResponseServices.js';
import { getBankaccountDao, updateBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getSettlementDaoforInternalTransfer } from '../settlement/settlementDao.js';
import { getMerchantsDao, updateMerchantDao } from '../merchants/merchantDao.js';
import { calculateCommission } from '../../utils/calculation.js';
import { getVendorsDao } from '../vendors/vendorDao.js';

const getBankResponse = async (req, res) => {
  const payload = req.query;
  const { role } = req.user;
  const { company_id } = req.user;
  payload.company_id = company_id;
  const data = await getBankResponseService(payload, role);
   return sendSuccess(res, data, 'get bankResponse successfully');
};

const createBankResponse = async (req, res) => {
  const { role } = req.user;
  const payload = req.body?.body;

  const { error } = CREATE_BANK_RESPONSE_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }

  try {
    const { company_id, user_id } = req.user;
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.BANK_RESPONSE
        : role === Role.VENDOR
          ? vendorColumns.BANK_RESPONSE
          : columns.BANK_RESPONSE;
    const splitData = payload.split(' ');
    const amount = parseFloat(splitData[0]);
    const upi_short_code = splitData[1];
    const utr = splitData[2];
    // const status = splitData[3];
    // const is_used = splitData[3];
    const bank_id = splitData[3];
    const from_UI = splitData[4];
    const created_by = user_id;
    const companyId = company_id;

    const isValidAmount = amount;
    const isValidAmountCode =
      upi_short_code !== 'nil' && upi_short_code.length === 5;
    const acceptedStatus = [
      'SUCCESS',
      'DISPUTE',
      'BANK_MISMATCH',
      'FAILED',
      'DUPLICATE',
    ];

    if (isValidAmount) {
      const utrAlreadyExist = await getBankResponseDao(
        { utr: utr, company_id: companyId },
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
        config: JSON.stringify({ from_UI: from_UI }),
        is_used: utrAlreadyExist ? 'false' : 'true',
        created_by,
        company_id: companyId,
      };

      if (isValidAmountCode) {
        updatedData.upi_short_code = upi_short_code;
      }

      const isAmountCodeExist = await getBankResponseDao(
        { upi_short_code: upi_short_code, company_id: companyId },
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
            company_id: updatedData.companyId,
          },
          null,
          null,
          null,
          null,
          filterColumns,
        );
        throw new CustomError(400, 'Amount code already exist');
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
          company_id: companyId,
          config: JSON.stringify({ from_UI: from_UI })
        };
        botRes = await createBankResponseDao(updatedData);
      } else {
        botRes = await createBankResponseDao(updatedData);
      }

      if (updatedData.status === 'REPEATED') {
        throw new CustomError(400, 'Entry with REPEATED UTR Added');
      }

      const checkPayInUtr = await getPayInUrlsDao({ user_submitted_utr: utr });
      if (checkPayInUtr?.length > 0) {
        if (upi_short_code && isValidAmountCode) {
          let dataUtr = checkPayInUtr[0]?.utr
            ? checkPayInUtr[0]?.utr
            : checkPayInUtr[0]?.user_submitted_utr;
          const getDataByUtr = await getBankResponseDaoAll(
            { utr: dataUtr, company_id: companyId },
            null,
            null,
            null,
            null,
            filterColumns,
          );
          const botUtrIsUsed = getDataByUtr?.some((item) => item.is_used);

          if (
            acceptedStatus.includes(checkPayInUtr[0]?.status) &&
            botUtrIsUsed
          ) {
            throw new CustomError(
              400,
              `The entry is already ${checkPayInUtr[0]?.status} with ${dataUtr} UTR`,
            );
          } else {
            if (!botUtrIsUsed) {
              //! krna h
              // We check bank exist here as we have to add the data to the res no matter what comes.
              const isBankExist = await getBankaccountDao({ id: bank_id });
              if (checkPayInUtr[0].bank_acc_id !== isBankExist?.id) {
                if (checkPayInUtr.at(0)?.user_submitted_utr) {
                  if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                    const payInData = {
                      amount: botRes?.amount,
                      status: 'BANK_MISMATCH',
                      is_notified: true,
                      user_submitted_utr: botRes?.utr,
                      approved_at: new Date(),
                      config: JSON.stringify({ from_UI: from_UI })
                    };
                    const updatePayInDataRes = await updatePayInUrlDao(
                      checkPayInUtr[0]?.id,
                      payInData,
                    );
                    // const updateBotRes
                    await updateBotResponseDao(botRes.id, { is_used: true, config: JSON.stringify({ from_UI: from_UI }) });
                    const bankdetails = await getBankaccountDao({
                      id: isBankExist?.id,
                    });

                    // We are adding the amount to the bank as we want to update the balance of the bank
                    // const updateBankRes = 
                    await updateBankaccountDao({
                      id: isBankExist.id,
                      balance: bankdetails.balance + parseFloat(amount),
                      today_balance: bankdetails.balance + parseFloat(amount),
                      config: JSON.stringify({ from_UI: from_UI })
                    });
                    const notifyData = {
                      status: 'BANK_MISMATCH',
                      merchantOrderId: updatePayInDataRes?.merchant_order_id,
                      payinId: updatePayInDataRes?.id,
                      amount: updatePayInDataRes?.amount,
                      req_amount: updatePayInDataRes?.amount,
                      utr_id: updatePayInDataRes?.user_submitted_utr,
                      config: JSON.stringify({ from_UI: from_UI })
                    };

                    try {
                      //when we get the correct notify url;
                      // const notifyMerchant =
                      await axios.post(
                        checkPayInUtr[0]?.notify_url,
                        notifyData,
                      );
                    } catch (error) {
                      console.log(error);
                    }
                     return sendSuccess(res, updatedData, { message: `Bank Mismatch with ${updatePayInDataRes?.merchant_order_id}` });

                  } else {
                    return {
                      error: {},
                      meta: { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}` },
                      data: {}
                    };
                  }
                } else {
                  const payInData = {
                    amount: botRes?.amount,
                    status: 'BANK_MISMATCH',
                    is_notified: true,
                    user_submitted_utr: botRes?.utr,
                    approved_at: new Date(),
                    config: JSON.stringify({ from_UI: from_UI })
                  };

                  const updatePayInDataRes = await updatePayInUrlDao(
                    checkPayInUtr[0]?.id,
                    payInData,
                  );

                  // const updateBotRes =
                  await updateBotResponseDao(botRes?.id, { is_used: true, config: JSON.stringify({ from_UI: from_UI }) });
                  const bankdetails = await getBankaccountDao({
                    id: isBankExist?.id,
                  });
                  // We are adding the amount to the bank as we want to update the balance of the bank
                  // const updateBankRes =
                  await updateBankaccountDao(isBankExist?.id, {
                    balance: bankdetails.balance + parseFloat(amount),
                    today_balance: bankdetails.balance + parseFloat(amount),
                  });
                  const notifyData = {
                    status: 'BANK_MISMATCH',
                    merchantOrderId: updatePayInDataRes?.merchant_order_id,
                    payinId: updatePayInDataRes?.id,
                    amount: updatePayInDataRes?.amount,
                    req_amount: updatePayInDataRes?.amount,
                    utr_id: updatePayInDataRes?.user_submitted_utr,
                    config: JSON.stringify({ from_UI: from_UI })
                  };

                  try {
                    //when we get the correct notify url;
                    const notifyMerchant = await axios.post(
                      checkPayInUtr[0]?.notify_url,
                      notifyData,
                    );
                    console.log(notifyMerchant, '4notifyMerchant');
                  } catch (error) {
                    console.log(error);
                  }
                   return sendSuccess(res, updatedData, { message: `Bank Mismatch with ${updatePayInDataRes?.merchant_order_id}` });

                }
              }

              // }

              // check if duplicate and return error
              const existingResponse = await getBankResponseDao(
                {
                  utr: utr,
                  is_used: true,
                  company_id: companyId,
                },
                null,
                null,
                null,
                null,
                filterColumns,
              );

              if (existingResponse?.length > 0) {
                throw new CustomError(400, 'The UTR already exists');
              }
              const getMerchantToGetPayinCommissionRes = await getMerchantsDao({
                id: checkPayInUtr[0]?.merchant_id,
              });
              const payinMerchantCommission = calculateCommission(
                botRes?.amount,
                getMerchantToGetPayinCommissionRes?.payin_merchant_commission,
              );
              const bankAccountDetails = await getBankaccountDao({
                id: checkPayInUtr[0].bank_acc_id,
              });
              const getVendorToGetPayinComission = await getVendorsDao({
                id: bankAccountDetails.user_id,
              });
              const payinVendorCommission = calculateCommission(
                botRes?.amount,
                getVendorToGetPayinComission?.payin_vendor_commission,
              );

              const durMs = new Date() - checkPayInUtr.at(0)?.created_at;
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

              if (checkPayInUtr.at(0)?.amount == amount) {
                if (checkPayInUtr.at(0)?.user_submitted_utr) {
                  if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                    const payInData = {
                      amount: botRes?.amount,
                      status: 'SUCCESS',
                      is_notified: true,
                      user_submitted_utr:
                        botRes?.utr || checkPayInUtr.at(0)?.user_submitted_utr,
                      // user_submitted_utr: checkPayInUtr.at(0)?.user_submitted_utr,
                      approved_at: new Date(),
                      duration: duration,
                      payin_merchant_commission: payinMerchantCommission,
                      payin_vendor_commission: payinVendorCommission,
                      config: JSON.stringify({ from_UI: from_UI })
                    };

                    const updatePayInDataRes = await updatePayInUrlDao(
                      checkPayInUtr[0]?.id,
                      payInData,
                    );

                    if (checkPayInUtr[0]?.bank_acc_id) {
                      const bankdetails = await getBankaccountDao({
                        id: isBankExist?.id,
                      });
                      // const updateBankRes =
                      await updateBankaccountDao(
                        checkPayInUtr[0]?.bank_acc_id,
                        {
                          balance: bankdetails.balance + parseFloat(amount),
                          today_balance:
                            bankdetails.balance + parseFloat(amount),
                        },
                      );
                    }
                    // const updateBotRes =
                    await updateBotResponseDao(botRes?.id, { is_used: true, config: JSON.stringify({ from_UI: from_UI }) });
                    const merchatnData = await getMerchantsDao({
                      id: checkPayInUtr[0]?.merchant_id,
                    });
                    // const updateMerchantData =
                    await updateMerchantDao(checkPayInUtr[0]?.merchant_id, {
                      balance: merchatnData.balance + parseFloat(amount),
                    });
                    const notifyData = {
                      status: 'SUCCESS',
                      merchantOrderId: updatePayInDataRes?.merchant_order_id,
                      payinId: updatePayInDataRes?.id,
                      amount: updatePayInDataRes?.amount,
                      utr_id: updatePayInDataRes?.user_submitted_utr,
                      config: JSON.stringify({ from_UI: from_UI })
                    };
                    try {
                      //when we get the correct notify url;
                      const notifyMerchant = await axios.post(
                        checkPayInUtr[0]?.notify_url,
                        notifyData,
                      );
                      console.log(notifyMerchant, '5notifyMerchant');
                    } catch (error) {
                      console.log(error);
                    }
                    return sendSuccess(
                      res,
                      updatedData,
                      "⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}",
                    );
                  } else {
                    return {
                      meta: {},
                      error: { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}` },
                      data: {}
                    };
                  }
                } else {
                  const payInData = {
                    amount: botRes?.amount,
                    status: 'SUCCESS',
                    is_notified: true,
                    user_submitted_utr:
                      botRes?.utr || checkPayInUtr.at(0)?.user_submitted_utr,
                    approved_at: new Date(),
                    duration: duration,
                    payin_merchant_commission: payinMerchantCommission,
                    payin_vendor_commission: payinVendorCommission,
                    config: JSON.stringify({ from_UI: from_UI })
                  };

                  const updatePayInDataRes = await updatePayInUrlDao(
                    checkPayInUtr[0]?.id,
                    payInData,
                  );

                  if (checkPayInUtr[0]?.bank_acc_id) {
                    const bankdetails = await getBankaccountDao({
                      id: isBankExist?.id,
                    });
                    // const updateBankRes =
                    await updateBankaccountDao(checkPayInUtr[0]?.bank_acc_id, {
                      balance: bankdetails.balance + parseFloat(amount),
                      today_balance: bankdetails.balance + parseFloat(amount),
                    });
                  }
                  // const updateBotRes =
                  await updateBotResponseDao(botRes?.id, { is_used: true, config: JSON.stringify({ from_UI: from_UI }) });
                  const merchatnData = await getMerchantsDao({
                    id: checkPayInUtr[0]?.merchant_id,
                  });
                  // const updateMerchantData =
                  await updateMerchantDao(checkPayInUtr[0]?.merchant_id, {
                    balance: merchatnData.balance + parseFloat(amount),
                  });
                  const notifyData = {
                    status: 'SUCCESS',
                    merchantOrderId: updatePayInDataRes?.merchant_order_id,
                    payinId: updatePayInDataRes?.id,
                    amount: updatePayInDataRes?.amount,
                    utr_id: updatePayInDataRes?.user_submitted_utr,
                    config: JSON.stringify({ from_UI: from_UI })
                  };
                  try {
                    //when we get the correct notify url;
                    // const notifyMerchant =
                    await axios.post(checkPayInUtr[0]?.notify_url, notifyData);
                  } catch (error) {
                    console.log(error);
                  }
                }
              } else {
                if (checkPayInUtr.at(0)?.user_submitted_utr) {
                  if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                    const payInData = {
                      amount: botRes?.amount,
                      status: 'DISPUTE',
                      is_notified: true,
                      user_submitted_utr: botRes?.utr,
                      approved_at: new Date(),
                      duration: duration,
                      payin_merchant_commission: payinMerchantCommission,
                      payin_vendor_commission: payinVendorCommission,
                      config: JSON.stringify({ from_UI: from_UI })
                    };
                    const updatePayInDataRes = await updatePayInUrlDao(
                      checkPayInUtr[0]?.id,
                      payInData,
                    );
                    const bankdetails = await getBankaccountDao({
                      id: isBankExist?.id,
                    });
                    // const updateBankRes =
                    await updateBankaccountDao(checkPayInUtr[0]?.bank_acc_id, {
                      balance: bankdetails.balance + parseFloat(amount),
                      today_balance: bankdetails.balance + parseFloat(amount),
                    });
                    // console.log(notifyMerchant, "7notifyMerchant")

                    // const updateBotRes =
                    await updateBotResponseDao(botRes?.id, { is_used: true, config: JSON.stringify({ from_UI: from_UI }) });
                    const notifyData = {
                      status: 'DISPUTE',
                      merchantOrderId: updatePayInDataRes?.merchant_order_id,
                      payinId: updatePayInDataRes?.id,
                      amount: updatePayInDataRes?.amount,
                      req_amount: updatePayInDataRes?.amount,
                      utr_id: updatePayInDataRes?.user_submitted_utr,
                      config: JSON.stringify({ from_UI: from_UI })
                    };

                    try {
                      //when we get the correct notify url;
                      const notifyMerchant = await axios.post(
                        checkPayInUtr[0]?.notify_url,
                        notifyData,
                      );
                      console.log(notifyMerchant, 'notifyMerchant');
                    } catch (error) {
                      console.log(error);
                    }
                     return sendSuccess(res, updatedData, { message: `Bank Mismatch with ${updatePayInDataRes?.merchant_order_id}` });


                  } else {
                    return {
                      meta: {},
                      error: { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}` },
                      data: {}
                    };
                  }
                } else {
                  const payInData = {
                    amount: botRes?.amount,
                    status: 'DISPUTE',
                    is_notified: true,
                    user_submitted_utr: botRes?.utr,
                    approved_at: new Date(),
                    duration: duration,
                    payin_merchant_commission: payinMerchantCommission,
                    payin_vendor_commission: payinVendorCommission,
                    config: JSON.stringify({ from_UI: from_UI })
                  };
                  const updatePayInDataRes = await updatePayInUrlDao(
                    checkPayInUtr[0]?.id,
                    payInData,
                  );
                  const bankdetails = await getBankaccountDao({
                    id: isBankExist?.id,
                  });
                  // const updateBankRes =
                  await updateBankaccountDao(checkPayInUtr[0]?.bank_acc_id, {
                    balance: bankdetails.balance + parseFloat(amount),
                    today_balance: bankdetails.balance + parseFloat(amount),
                  });

                  // const updateBotRes =
                  await updateBotResponseDao(botRes?.id, { is_used: true });
                  const notifyData = {
                    status: 'DISPUTE',
                    merchantOrderId: updatePayInDataRes?.merchant_order_id,
                    payinId: updatePayInDataRes?.id,
                    amount: updatePayInDataRes?.amount,
                    req_amount: updatePayInDataRes?.amount,
                    utr_id: updatePayInDataRes?.user_submitted_utr,
                    config: JSON.stringify({ from_UI: from_UI })
                  };

                  try {
                    //when we get the correct notify url;
                    // const notifyMerchant =
                    await axios.post(checkPayInUtr[0]?.notify_url, notifyData);
                  } catch (error) {
                    console.log(error);
                  }
                }
              }
            }
          }
        }
        if (!acceptedStatus.includes(checkPayInUtr[0]?.status)) {
          // We check bank exist here as we have to add the data to the res no matter what comes.
          const isBankExist = await getBankaccountDao({ id: bank_id });
          if (!isBankExist) {
            if (checkPayInUtr.at(0)?.user_submitted_utr) {
              if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                const payInData = {
                  amount: botRes?.amount,
                  status: 'BANK_MISMATCH',
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  approved_at: new Date(),
                  config: JSON.stringify({ from_UI: from_UI })
                };
                const updatePayInDataRes = await updatePayInUrlDao(
                  checkPayInUtr[0]?.id,
                  payInData,
                );

                // const updateBotRes =
                await updateBotResponseDao(botRes?.id, { is_used: true });
                const bankdetails = await getBankaccountDao({
                  id: isBankExist?.id,
                }); // We are adding the amount to the bank as we want to update the balance of the bank
                // const updateBankRes =
                await updateBankaccountDao(isBankExist?.id, {
                  balance: bankdetails.balance + parseFloat(amount),
                  today_balance: bankdetails.balance + parseFloat(amount),
                });

                const notifyData = {
                  status: 'BANK_MISMATCH',
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.amount,
                  req_amount: updatePayInDataRes?.amount,
                  utr_id: updatePayInDataRes?.user_submitted_utr,
                  config: JSON.stringify({ from_UI: from_UI })
                };

                try {
                  //when we get the correct notify url;
                  const notifyMerchant = await axios.post(
                    checkPayInUtr[0]?.notify_url,
                    notifyData,
                  );
                  console.log(notifyMerchant, 'notifyMerchant');
                } catch (error) {
                  console.log(error);
                }
                console.log('Bank Response created successfully', 'info');
                return sendSuccess(
                  res,
                  updatedData,
                  "⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}",
                );
              } else {
                return {
                  meta: {},
                  error: { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}` },
                  data: {}
                };
              }
            } else {
              const payInData = {
                amount: botRes?.amount,
                status: 'BANK_MISMATCH',
                is_notified: true,
                user_submitted_utr: botRes?.utr,
                approved_at: new Date(),
                config: JSON.stringify({ from_UI: from_UI })
              };

              const updatePayInDataRes = await updatePayInUrlDao(
                checkPayInUtr[0]?.id,
                payInData,
              );

              // const updateBotRes =
              await updateBotResponseDao(botRes?.id, { is_used: true });
              // We are adding the amount to the bank as we want to update the balance of the bank
              const bankdetails = await getBankaccountDao({
                id: isBankExist?.id,
              });
              // const updateBankRes =
              await updateBankaccountDao(isBankExist?.id, {
                balance: bankdetails.balance + parseFloat(amount),
                today_balance: bankdetails.balance + parseFloat(amount),
              });

              const notifyData = {
                status: 'BANK_MISMATCH',
                merchantOrderId: updatePayInDataRes?.merchant_order_id,
                payinId: updatePayInDataRes?.id,
                amount: updatePayInDataRes?.amount,
                req_amount: updatePayInDataRes?.amount,
                utr_id: updatePayInDataRes?.user_submitted_utr,
                config: JSON.stringify({ from_UI: from_UI })
              };

              try {
                //when we get the correct notify url;
                const notifyMerchant = await axios.post(
                  checkPayInUtr[0]?.notify_url,
                  notifyData,
                );
                console.log(notifyMerchant);
              } catch (error) {
                console.log(error);
              }
              console.log('Bank Response created successfully', 'info');

              return sendSuccess(
                res,
                updatedData,
                "⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}",
              );
            }
          }

          if (checkPayInUtr[0].bank_acc_id !== isBankExist?.id) {
            if (checkPayInUtr.at(0)?.user_submitted_utr) {
              if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                const payInData = {
                  amount: botRes?.amount,
                  status: 'BANK_MISMATCH',
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  approved_at: new Date(),
                  config: JSON.stringify({ from_UI: from_UI })
                };

                const updatePayInDataRes = await updatePayInUrlDao(
                  checkPayInUtr[0]?.id,
                  payInData,
                );

                // const updateBotRes =
                await updateBotResponseDao(botRes?.id, { is_used: true });
                // We are adding the amount to the bank as we want to update the balance of the bank
                const bankdetails = await getBankaccountDao({
                  id: isBankExist?.id,
                });
                // const updateBankRes =
                await updateBankaccountDao(isBankExist?.id, {
                  balance: bankdetails.balance + parseFloat(amount),
                  today_balance: bankdetails.balance + parseFloat(amount),
                });
                const notifyData = {
                  status: 'BANK_MISMATCH',
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.amount,
                  req_amount: updatePayInDataRes?.amount,
                  utr_id: updatePayInDataRes?.user_submitted_utr,
                  config: JSON.stringify({ from_UI: from_UI })
                };
                try {
                  //when we get the correct notify url;
                  const notifyMerchant = await axios.post(
                    checkPayInUtr[0]?.notify_url,
                    notifyData,
                  );
                  console.log(notifyMerchant);
                } catch (error) {
                  console.log(error);
                }
                console.log('Bank Response created successfully', 'info');
                return sendSuccess(
                  res,
                  updatedData,
                  "⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}",
                );
              } else {
                return {
                  meta: {},
                  error: { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}` },
                  data: {}
                };
              }
            } else {
              const payInData = {
                amount: botRes?.amount,
                status: 'BANK_MISMATCH',
                is_notified: true,
                user_submitted_utr: botRes?.utr,
                approved_at: new Date(),
                config: JSON.stringify({ from_UI: from_UI })
              };

              const updatePayInDataRes = await updatePayInUrlDao(
                checkPayInUtr[0]?.id,
                payInData,
              );

              // const updateBotRes =
              await updateBotResponseDao(botRes?.id, { is_used: true });
              // We are adding the amount to the bank as we want to update the balance of the bank
              const bankdetails = await getBankaccountDao({
                id: isBankExist?.id,
              });
              // const updateBankRes =
              await updateBankaccountDao(isBankExist?.id, {
                balance: bankdetails.balance + parseFloat(amount),
              });

              const notifyData = {
                status: 'BANK_MISMATCH',
                merchantOrderId: updatePayInDataRes?.merchant_order_id,
                payinId: updatePayInDataRes?.id,
                amount: updatePayInDataRes?.amount,
                req_amount: updatePayInDataRes?.amount,
                utr_id: updatePayInDataRes?.user_submitted_utr,
                config: JSON.stringify({ from_UI: from_UI })
              };

              try {
                //when we get the correct notify url;
                // const notifyMerchant =
                await axios.post(checkPayInUtr[0]?.notify_url, notifyData);
              } catch (error) {
                console.log(error);
              }
              return sendSuccess(
                res,
                updatedData,
                "⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}",
              );
            }
          }

          // check if duplicate and return error
          const existingResponse = await getBankResponseDao(
            { utr: utr, is_used: true, company_id: companyId },
            null,
            null,
            null,
            null,
            filterColumns,
          );
          if (existingResponse?.length > 0) {
            throw new CustomError(400, 'The UTR already exists');
          }
          const getMerchantToGetPayinCommissionRes = await getMerchantsDao({
            id: checkPayInUtr[0]?.merchant_id,
          });
          const payinMerchantCommission = calculateCommission(
            botRes?.amount,
            getMerchantToGetPayinCommissionRes?.payin_merchant_commission,
          );
          const bankAccountDetails = await getBankaccountDao({
            id: checkPayInUtr[0].bank_acc_id,
          });
          const getVendorToGetPayinComission = await getVendorsDao({
            id: bankAccountDetails.user_id,
          });
          const payinVendorCommission = calculateCommission(
            botRes?.amount,
            getVendorToGetPayinComission?.payin_vendor_commission,
          );

          const durMs = new Date() - checkPayInUtr.at(0)?.created_at;
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

          if (checkPayInUtr.at(0)?.amount == amount) {
            if (checkPayInUtr.at(0)?.user_submitted_utr) {
              if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                const payInData = {
                  amount: botRes?.amount,
                  status: 'SUCCESS',
                  is_notified: true,
                  user_submitted_utr:
                    botRes?.utr || checkPayInUtr.at(0)?.user_submitted_utr,
                  approved_at: new Date(),
                  duration: duration,
                  payin_merchant_commission: payinMerchantCommission,
                  payin_vendor_commission: payinVendorCommission,
                  config: JSON.stringify({ from_UI: from_UI })
                };

                const updatePayInDataRes = await updatePayInUrlDao(
                  checkPayInUtr[0]?.id,
                  payInData,
                );

                if (checkPayInUtr[0]?.bank_acc_id) {
                  const bankdetails = await getBankaccountDao({
                    id: isBankExist?.id,
                  });
                  // const updateBankRes =
                  await updateBankaccountDao(checkPayInUtr[0]?.bank_acc_id, {
                    balance: bankdetails.balance + parseFloat(amount),
                    today_balance: bankdetails.balance + parseFloat(amount),
                  });
                }

                // const updateBotRes =
                await updateBotResponseDao(botRes?.id, { is_used: true });
                const merchatnData = await getMerchantsDao({
                  id: checkPayInUtr[0]?.merchant_id,
                });
                // const updateMerchantData =
                await updateMerchantDao(checkPayInUtr[0]?.merchant_id, {
                  balance: merchatnData.balance + parseFloat(amount),
                });
                const notifyData = {
                  status: 'SUCCESS',
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.amount,
                  utr_id: updatePayInDataRes?.user_submitted_utr,
                  config: JSON.stringify({ from_UI: from_UI })
                };
                try {
                  //when we get the correct notify url;
                  // const notifyMerchant =
                  await axios.post(checkPayInUtr[0]?.notify_url, notifyData);
                } catch (error) {
                  console.log(error);
                }
                return sendSuccess(
                  res,
                  updatedData,
                  "⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}",
                );
              } else {
                return {
                  meta: {},
                  error: { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}` },
                  data: {}
                };
              }
            } else {
              const payInData = {
                amount: botRes?.amount,
                status: 'SUCCESS',
                is_notified: true,
                user_submitted_utr:
                  botRes?.utr || checkPayInUtr.at(0)?.user_submitted_utr,
                approved_at: new Date(),
                duration: duration,
                payin_merchant_commission: payinMerchantCommission,
                payin_vendor_commission: payinVendorCommission,
                config: JSON.stringify({ from_UI: from_UI })
              };

              const updatePayInDataRes = await updatePayInUrlDao(
                checkPayInUtr[0]?.id,
                payInData,
              );

              if (checkPayInUtr[0]?.bank_acc_id) {
                const bankdetails = await getBankaccountDao({
                  id: isBankExist?.id,
                });

                // const updateBankRes =
                await updateBankaccountDao(checkPayInUtr[0]?.bank_acc_id, {
                  balance: bankdetails.balance + parseFloat(amount),
                  today_balance: bankdetails.balance + parseFloat(amount),
                });
              }
              // const updateBotRes =
              await updateBotResponseDao(botRes?.id, { is_used: true });
              const merchatnData = await getMerchantsDao({
                id: checkPayInUtr[0]?.merchant_id,
              });
              // const updateMerchantData =
              await updateMerchantDao(checkPayInUtr[0]?.merchant_id, {
                balance: merchatnData.balance + parseFloat(amount),
              });
              const notifyData = {
                status: 'SUCCESS',
                merchantOrderId: updatePayInDataRes?.merchant_order_id,
                payinId: updatePayInDataRes?.id,
                amount: updatePayInDataRes?.amount,
                utr_id: updatePayInDataRes?.user_submitted_utr,
                config: JSON.stringify({ from_UI: from_UI })
              };
              try {
                //when we get the correct notify url;
                // const notifyMerchant =
                await axios.post(checkPayInUtr[0]?.notify_url, notifyData);
              } catch (error) {
                console.log(error);
              }
            }
          } else {
            if (checkPayInUtr.at(0)?.user_submitted_utr) {
              if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                const payInData = {
                  amount: botRes?.amount,
                  status: 'DISPUTE',
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  approved_at: new Date(),
                  duration: duration,
                  payin_merchant_commission: payinMerchantCommission,
                  payin_vendor_commission: payinVendorCommission,
                  config: JSON.stringify({ from_UI: from_UI })
                };
                const updatePayInDataRes = await updatePayInUrlDao(
                  checkPayInUtr[0]?.id,
                  payInData,
                );
                const bankdetails = await getBankaccountDao({
                  id: isBankExist?.id,
                });

                // const updateBankRes =
                await updateBankaccountDao(checkPayInUtr[0]?.bank_acc_id, {
                  balance: bankdetails.balance + parseFloat(amount),
                  today_balance: bankdetails.balance + parseFloat(amount),
                });
                // const updateBotRes =
                await updateBotResponseDao(botRes?.id, { is_used: true });
                const notifyData = {
                  status: 'DISPUTE',
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.amount,
                  req_amount: updatePayInDataRes?.amount,
                  utr_id: updatePayInDataRes?.user_submitted_utr,
                  config: JSON.stringify({ from_UI: from_UI })
                };

                try {
                  //when we get the correct notify url;
                  // const notifyMerchant =
                  await axios.post(checkPayInUtr[0]?.notify_url, notifyData);
                } catch (error) {
                  console.log(error);
                }
               
                return sendSuccess(
                  res,
                  updatedData,
                  "⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}",
                );
                
              } else {
                return {
                  meta: {},
                  error: { message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}` },
                  data: updatedData
                };
              }
            } else {
              const payInData = {
                amount: botRes?.amount,
                status: 'DISPUTE',
                is_notified: true,
                user_submitted_utr: botRes?.utr,
                approved_at: new Date(),
                duration: duration,
                payin_merchant_commission: payinMerchantCommission,
                payin_vendor_commission: payinVendorCommission,
                config: JSON.stringify({ from_UI: from_UI })
              };
              const updatePayInDataRes = await updatePayInUrlDao(
                checkPayInUtr[0]?.id,
                payInData,
              );
              const bankdetails = await getBankaccountDao({
                id: isBankExist?.id,
              });
              // const updateBankRes =
              await updateBankaccountDao(checkPayInUtr[0]?.bank_acc_id, {
                balance: bankdetails.balance + parseFloat(amount),
                today_balance: bankdetails.balance + parseFloat(amount),
              });

              // const updateBotRes
              await updateBotResponseDao(botRes?.id, { is_used: true, config: JSON.stringify({ from_UI: from_UI }) });
              const notifyData = {
                status: 'DISPUTE',
                merchantOrderId: updatePayInDataRes?.merchant_order_id,
                payinId: updatePayInDataRes?.id,
                amount: updatePayInDataRes?.amount,
                req_amount: updatePayInDataRes?.amount,
                utr_id: updatePayInDataRes?.user_submitted_utr,
                config: JSON.stringify({ from_UI: from_UI })
              };
              
              try {
                await axios.post(checkPayInUtr[0]?.notify_url, notifyData);
              } catch (error) {
                console.log(error);
              }
              return sendSuccess(
                res,
                updatedData,
                "⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}",
              );
            }
          }
        }
      }
      return sendSuccess(
        res,
        updatedData,
        "Response created successfully",
      );
    } else {
      return {
        error: {},
        meta: { message: `Invalid data received` },
        data: {}
      };
    }
  } catch (error) {
    console.log('Error while creating Bank Response', 'error', error);
    throw new InternalServerError('Error occurred while creating Bank Response');
  }
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
    role, page, limit,
  );
  return sendSuccess(res, data, 'Get BankResponse successfully');
};

const resetBankResponse = async (req, res) => {
  const { company_id, user_id } = req.user;
  const { id } = req.params;
  const botRes = await getBankResponseDao({ id: id, company_id: company_id });
  let getallPayinDataByUtr;
  getallPayinDataByUtr = await getPayInUrlsDao({
    user_submitted_utr: botRes.utr,
  });

  const hasSuccess = getallPayinDataByUtr?.some(
    (item) => item.status === 'SUCCESS',
  );

  if (!hasSuccess) {
    const data = {
      is_used: false,
      updated_by: user_id,
    };
    await updateBotResponseDao(id, data);

    const isEqualUTR = getallPayinDataByUtr?.some(
      (item) => item.user_submitted_utr === botRes.utr,
    );
    if (isEqualUTR) {
      const updatePayinID = getallPayinDataByUtr?.filter(
        (item) =>
          item.user_submitted_utr === botRes.utr && item.status !== 'FAILED',
      );
      const updatePayinData = {
        status: 'ASSIGNED',
        user_submitted_utr: null,
        updated_by: user_id,
      };
      await updatePayInUrlDao(updatePayinID[0]?.id, updatePayinData);
    }
    return sendSuccess(res, 'Bot response Reset successful');
  } else {
    const successPayinDataID = getallPayinDataByUtr?.filter(
      (item) => item.status === 'SUCCESS',
    );
    return sendSuccess(
      res,
      {},
      `UTR of this entry is already used with ${successPayinDataID[0]?.merchant_order_id} Merchant Order ID, No Changes Applied`,
    );
  }
};

export {
  getBankResponse,
  createBankResponse,
  getBankMessage,
  resetBankResponse,
};
