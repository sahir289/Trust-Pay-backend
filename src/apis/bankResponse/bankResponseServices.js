import { BadRequestError, CustomError, } from '../../utils/appErrors.js';

import {
  getBankResponseDao,
  createBankResponseDao,
  getBankMessageDao, resetBankResponseDao,
  updateBotResponseDao,
  getBankResponseDaoAll
} from './bankResponseDao.js';
import Logger from '../../utils/logger.js';
import { getBankaccountDao, updateBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getSettlementDaoforInternalTransfer } from '../settlement/settlementDao.js';
import axios from 'axios';
import { getPayInUrlsDao, updatePayInDao } from '../payIn/payInDao.js';
import { getMerchantsDao, updateMerchantDao } from '../merchants/merchantDao.js';
import { calculateCommission } from '../../utils/calculation.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
const logger = new Logger()

const createBankResponseService = async (payload) => {
  try {

    const splitData = payload.split(" ");
    // const status = splitData[0];
    const amount = parseFloat(splitData[1]);
    const upi_short_code = splitData[2];
    const utr = splitData[3];
    const bank_id = splitData[4];
    const is_used = splitData[5];
    const created_by = splitData[6];
    const company_id = splitData[7];

    const isValidAmount = amount;
    const isValidAmountCode =
    upi_short_code !== "nil" && upi_short_code.length === 5;
    const acceptedStatus = ["SUCCESS", "DISPUTE", "BANK_MISMATCH", "FAILED", "DUPLICATE"]


    if (isValidAmount) {
      const utrAlreadyExist = await getBankResponseDao({ utr: utr });
      const updatedData = {
        status: utrAlreadyExist ? "/repeated" : "/success",
        amount,
        utr,
        bank_id,
        is_used,
        created_by,
        company_id
      };

      if (isValidAmountCode) {
        updatedData.upi_short_code = upi_short_code;
      }

      const isAmountCodeExist = await getBankResponseDao({upi_short_code : upi_short_code})

      if (isAmountCodeExist) {
        // const botRes = 
        await getBankResponseDao({status : updatedData.status , amount : updatedData.amount , 
          utr : updatedData.utr , bank_id : updatedData.bank_id , is_used : updatedData.is_used , created_by : updatedData.created_by ,
          company_id : updatedData.company_id
        });
        throw new CustomError(400, "Amount code already exist")
      }

      let botRes
      const utrinternalTransfer = await getSettlementDaoforInternalTransfer(
         utr,
        ["INTERNAL_QR_TRANSFER", "INTERNAL_BANK_TRANSFER"]
      );

      if (utrinternalTransfer) {
        const updatedData = {
          status: "/internalTransfer",
          amount: amount,
          utr: utr,
          bank_id: bank_id,
          is_used: false,
          created_by: created_by,
          company_id: company_id
        };
        botRes = await createBankResponseDao(updatedData);
      }
      else {
        botRes = await createBankResponseDao(updatedData);
      }

      if (updatedData.status === "REPEATED") {
        throw new CustomError(400, "Entry with REPEATED UTR Added")
      }


      const checkPayInUtr = await getPayInUrlsDao({ user_submitted_utr: utr });
      if (checkPayInUtr?.length > 0) {
        if (upi_short_code && isValidAmountCode) {
        let dataUtr = checkPayInUtr[0]?.utr ? checkPayInUtr[0]?.utr : checkPayInUtr[0]?.user_submitted_utr
        const getDataByUtr = await getBankResponseDaoAll({ utr: dataUtr })
        const botUtrIsUsed = getDataByUtr?.some((item) => item.is_used);

        if (acceptedStatus.includes(checkPayInUtr[0]?.status) && botUtrIsUsed) {
          throw new CustomError(400, `The entry is already ${checkPayInUtr[0]?.status} with ${dataUtr} UTR`);
        }

        else {
          if (!botUtrIsUsed) { //! krna h
            // We check bank exist here as we have to add the data to the res no matter what comes.          
            const isBankExist = await getBankaccountDao({ id: bank_id })
            if (checkPayInUtr[0].bank_acc_id !== isBankExist?.id) {
              if (checkPayInUtr.at(0)?.user_submitted_utr) {
                if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                  const payInData = {
                    confirmed: botRes?.amount,
                    status: "BANK_MISMATCH",
                    is_notified: true,
                    user_submitted_utr: botRes?.utr,
                    approved_at: new Date(),
                  };
                  const updatePayInDataRes = await updatePayInDao(
                    checkPayInUtr[0]?.id,
                    payInData
                  );
                  // const updateBotRes
                  await updateBotResponseDao(botRes.id, { is_used: true })
                  const bankdetails = await getBankaccountDao({ id: isBankExist?.id })

                  // We are adding the amount to the bank as we want to update the balance of the bank
                   const updateBankRes = 
                  await updateBankaccountDao(
                    {
                      id: isBankExist.id,
                      balance: bankdetails.balance + parseFloat(amount),
                      today_balance: bankdetails.balance + parseFloat(amount)
                    }
                  );
                  const notifyData = {
                    status: "BANK_MISMATCH",
                    merchantOrderId: updatePayInDataRes?.merchant_order_id,
                    payinId: updatePayInDataRes?.id,
                    amount: updatePayInDataRes?.confirmed,
                    req_amount: updatePayInDataRes?.amount,
                    utr_id: updatePayInDataRes?.user_submitted_utr
                  };

                  try {
                    //when we get the correct notify url;
                    // const notifyMerchant =
                    await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                  } catch (error) {
                    console.log(error)
                  }
                  return updateBankRes
                } else {
                  return `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}`
                }
              } else {
                const payInData = {
                  confirmed: botRes?.amount,
                  status: "BANK_MISMATCH",
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  approved_at: new Date(),
                };

                const updatePayInDataRes = await updatePayInDao(
                  checkPayInUtr[0]?.id,
                  payInData
                );

                // const updateBotRes = 
                await updateBotResponseDao(botRes?.id, { is_used: true })
                const bankdetails = await getBankaccountDao({ id: isBankExist?.id })
                // We are adding the amount to the bank as we want to update the balance of the bank
                // const updateBankRes = 
                await updateBankaccountDao(
                  isBankExist?.id,
                  {
                    balance: bankdetails.balance + parseFloat(amount),
                    today_balance: bankdetails.balance + parseFloat(amount)
                  }
                );
                const notifyData = {
                  status: "BANK_MISMATCH",
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.confirmed,
                  req_amount: updatePayInDataRes?.amount,
                  utr_id: updatePayInDataRes?.user_submitted_utr
                };

                try {
                  //when we get the correct notify url;
                  const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                  console.log(notifyMerchant, "4notifyMerchant")
                } catch (error) {
                  console.log(error)
                }
                console.log('Bank Response created successfully', 'info');
                return updatePayInDataRes

              }
            }

            // }

            // check if duplicate and return error
            const existingResponse = await getBankResponseDao({
              utr: utr,
              is_used: true
            });

            if (existingResponse?.length > 0) {
              throw new CustomError(400, "The UTR already exists");
            }
            const getMerchantToGetPayinCommissionRes = await getMerchantsDao({ id: checkPayInUtr[0]?.merchant_id })
            const payinMerchantCommission = calculateCommission(botRes?.amount, getMerchantToGetPayinCommissionRes?.payin_merchant_commission);
            const bankAccountDetails = await getBankaccountDao({ id: checkPayInUtr[0].bank_acc_id })
            const getVendorToGetPayinComission = await getVendorsDao({ id: bankAccountDetails.user_id })
            const payinVendorCommission = calculateCommission(botRes?.amount, getVendorToGetPayinComission?.payin_vendor_commission);

            const durMs = new Date() - checkPayInUtr.at(0)?.created_at;
            const durSeconds = Math.floor((durMs / 1000) % 60).toString().padStart(2, '0');
            const durMinutes = Math.floor((durSeconds / 60) % 60).toString().padStart(2, '0');
            const durHours = Math.floor((durMinutes / 60) % 24).toString().padStart(2, '0');
            const duration = `${durHours}:${durMinutes}:${durSeconds}`;

            if (checkPayInUtr.at(0)?.amount == amount
            ) {
              if (checkPayInUtr.at(0)?.user_submitted_utr) {
                if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                  const payInData = {
                    confirmed: botRes?.amount,
                    status: "SUCCESS",
                    is_notified: true,
                    user_submitted_utr: botRes?.utr || checkPayInUtr.at(0)?.user_submitted_utr,
                    // user_submitted_utr: checkPayInUtr.at(0)?.user_submitted_utr,
                    approved_at: new Date(),
                    duration: duration,
                    payin_merchant_commission: payinMerchantCommission,
                    payin_vendor_commission: payinVendorCommission,

                  };

                  const updatePayInDataRes = await updatePayInDao(
                    checkPayInUtr[0]?.id,
                    payInData
                  );

                  if (checkPayInUtr[0]?.bank_acc_id) {
                    const bankdetails = await getBankaccountDao({ id: isBankExist?.id })
                    // const updateBankRes = 
                    await updateBankaccountDao(
                      checkPayInUtr[0]?.bank_acc_id,
                      {
                        balance: bankdetails.balance + parseFloat(amount),
                        today_balance: bankdetails.balance + parseFloat(amount)
                      }
                    );

                  }
                  // const updateBotRes = 
                  await updateBotResponseDao(botRes?.id, { is_used: true })
                  const merchatnData = await getMerchantsDao({ id: checkPayInUtr[0]?.merchant_id })
                  // const updateMerchantData = 
                  await updateMerchantDao(checkPayInUtr[0]?.merchant_id, { balance: merchatnData.balance + parseFloat(amount) })
                  const notifyData = {
                    status: "SUCCESS",
                    merchantOrderId: updatePayInDataRes?.merchant_order_id,
                    payinId: updatePayInDataRes?.id,
                    amount: updatePayInDataRes?.confirmed,
                    utr_id: updatePayInDataRes?.user_submitted_utr
                  };
                  try {
                    //when we get the correct notify url;
                    const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                    console.log(notifyMerchant, "5notifyMerchant")
                  } catch (error) {
                    console.log(error)
                  }
                } else {
                  return `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}`

                }
              } else {
                const payInData = {
                  confirmed: botRes?.amount,
                  status: "SUCCESS",
                  is_notified: true,
                  user_submitted_utr: botRes?.utr || checkPayInUtr.at(0)?.user_submitted_utr,
                  approved_at: new Date(),
                  duration: duration,
                  payin_merchant_commission: payinMerchantCommission,
                  payin_mvendor_commission: payinVendorCommission,
                };

                const updatePayInDataRes = await updatePayInDao(
                  checkPayInUtr[0]?.id,
                  payInData
                );

                if (checkPayInUtr[0]?.bank_acc_id) {
                  const bankdetails = await getBankaccountDao({ id: isBankExist?.id })
                  // const updateBankRes = 
                  await updateBankaccountDao(
                    checkPayInUtr[0]?.bank_acc_id,
                    {
                      balance: bankdetails.balance + parseFloat(amount),
                      today_balance: bankdetails.balance + parseFloat(amount)
                    }
                  );
                }
                // const updateBotRes = 
                await updateBotResponseDao(botRes?.id, { is_used: true })
                const merchatnData = await getMerchantsDao({ id: checkPayInUtr[0]?.merchant_id })
                // const updateMerchantData = 
                await updateMerchantDao(checkPayInUtr[0]?.merchant_id, { balance: merchatnData.balance + parseFloat(amount) })
                const notifyData = {
                  status: "SUCCESS",
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.confirmed,
                  utr_id: updatePayInDataRes?.user_submitted_utr
                };
                try {
                  //when we get the correct notify url;
                  // const notifyMerchant = 
                  await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                } catch (error) {
                  console.log(error)
                }
              }
            }
            else {
              if (checkPayInUtr.at(0)?.user_submitted_utr) {
                if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                  const payInData = {
                    confirmed: botRes?.amount,
                    status: "DISPUTE",
                    is_notified: true,
                    user_submitted_utr: botRes?.utr,
                    approved_at: new Date(),
                    duration: duration,
                    payin_merchant_commission: payinMerchantCommission,
                    payin_mvendor_commission: payinVendorCommission,
                  };
                  const updatePayInDataRes = await updatePayInDao(
                    checkPayInUtr[0]?.id,
                    payInData
                  );
                  const bankdetails = await getBankaccountDao({ id: isBankExist?.id })
                  // const updateBankRes =
                  await updateBankaccountDao(

                    checkPayInUtr[0]?.bank_acc_id,
                    {
                      balance: bankdetails.balance + parseFloat(amount),
                      today_balance: bankdetails.balance + parseFloat(amount)
                    }
                  );
                  // console.log(notifyMerchant, "7notifyMerchant")


                  // const updateBotRes = 
                  await updateBotResponseDao(botRes?.id, { is_used: true });
                  const notifyData = {
                    status: "DISPUTE",
                    merchantOrderId: updatePayInDataRes?.merchant_order_id,
                    payinId: updatePayInDataRes?.id,
                    amount: updatePayInDataRes?.confirmed,
                    req_amount: updatePayInDataRes?.amount,
                    utr_id: updatePayInDataRes?.user_submitted_utr
                  };

                  try {
                    //when we get the correct notify url;
                    const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                    console.log(notifyMerchant, "notifyMerchant")
                  } catch (error) {
                    console.log(error)
                  }
                } else {
                  return `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}`

                }
              } else {
                const payInData = {
                  confirmed: botRes?.amount,
                  status: "DISPUTE",
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  approved_at: new Date(),
                  duration: duration,
                  payin_merchant_commission: payinMerchantCommission,
                  payin_mvendor_commission: payinVendorCommission,
                };
                const updatePayInDataRes = await updatePayInDao(
                  checkPayInUtr[0]?.id,
                  payInData
                );
                const bankdetails = await getBankaccountDao({ id: isBankExist?.id })
                // const updateBankRes = 
                await updateBankaccountDao(
                  checkPayInUtr[0]?.bank_acc_id,
                  {
                    balance: bankdetails.balance + parseFloat(amount),
                    today_balance: bankdetails.balance + parseFloat(amount)
                  }
                );

                // const updateBotRes = 
                await updateBotResponseDao(botRes?.id, { is_used: true });
                const notifyData = {
                  status: "DISPUTE",
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.confirmed,
                  req_amount: updatePayInDataRes?.amount,
                  utr_id: updatePayInDataRes?.user_submitted_utr
                };

                try {
                  //when we get the correct notify url;
                  // const notifyMerchant = 
                  await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                } catch (error) {
                  console.log(error)

                }
              }
            }
          }
        }
      }
        if (!acceptedStatus.includes(checkPayInUtr[0]?.status)) {

          // We check bank exist here as we have to add the data to the res no matter what comes.
          const isBankExist = await getBankaccountDao({ id: bank_id })
          if (!isBankExist) {
            if (checkPayInUtr.at(0)?.user_submitted_utr) {
              if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                const payInData = {
                  confirmed: botRes?.amount,
                  status: "BANK_MISMATCH",
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  approved_at: new Date(),
                };
                const updatePayInDataRes = await updatePayInDao(
                  checkPayInUtr[0]?.id,
                  payInData
                );

                // const updateBotRes = 
                await updateBotResponseDao(botRes?.id, { is_used: true })
                const bankdetails = await getBankaccountDao({ id: isBankExist?.id })// We are adding the amount to the bank as we want to update the balance of the bank
                // const updateBankRes = 
                await updateBankaccountDao(
                  isBankExist?.id,
                  {
                    balance: bankdetails.balance + parseFloat(amount),
                    today_balance: bankdetails.balance + parseFloat(amount)
                  }
                );

                const notifyData = {
                  status: "BANK_MISMATCH",
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.confirmed,
                  req_amount: updatePayInDataRes?.amount,
                  utr_id: updatePayInDataRes?.user_submitted_utr
                };

                try {
                  //when we get the correct notify url;
                  const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                  console.log(notifyMerchant, "notifyMerchant")
                } catch (error) {
                  console.log(error)
                }
                console.log('Bank Response created successfully', 'info');
                return updatePayInDataRes

              } else {
                `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}`

              }
            } else {
              const payInData = {
                confirmed: botRes?.amount,
                status: "BANK_MISMATCH",
                is_notified: true,
                user_submitted_utr: botRes?.utr,
                approved_at: new Date(),
              };

              const updatePayInDataRes = await updatePayInDao(
                checkPayInUtr[0]?.id,
                payInData
              );

              // const updateBotRes = 
              await updateBotResponseDao(botRes?.id, { is_used: true })
              // We are adding the amount to the bank as we want to update the balance of the bank
              const bankdetails = await getBankaccountDao({ id: isBankExist?.id })
              // const updateBankRes = 
              await updateBankaccountDao(
                isBankExist?.id,
                {
                  balance: bankdetails.balance + parseFloat(amount),
                  today_balance: bankdetails.balance + parseFloat(amount)
                }
              );

              const notifyData = {
                status: "BANK_MISMATCH",
                merchantOrderId: updatePayInDataRes?.merchant_order_id,
                payinId: updatePayInDataRes?.id,
                amount: updatePayInDataRes?.confirmed,
                req_amount: updatePayInDataRes?.amount,
                utr_id: updatePayInDataRes?.user_submitted_utr
              };

              try {
                //when we get the correct notify url;
                const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                console.log(notifyMerchant)
              } catch (error) {
                console.log(error)

              }
              console.log('Bank Response created successfully', 'info');

              return updatePayInDataRes

            }
          }

          if (checkPayInUtr[0].bank_acc_id !== isBankExist?.id) {
            console.log(checkPayInUtr[0], "iuytdrsdxfcgvhb")
            if (checkPayInUtr.at(0)?.user_submitted_utr) {
              if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                const payInData = {
                  confirmed: botRes?.amount,
                  status: "BANK_MISMATCH",
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  approved_at: new Date(),
                };

                const updatePayInDataRes = await updatePayInDao(
                  checkPayInUtr[0]?.id,
                  payInData
                );

                // const updateBotRes = 
                await updateBotResponseDao(botRes?.id, { is_used: true })
                // We are adding the amount to the bank as we want to update the balance of the bank
                const bankdetails = await getBankaccountDao({ id: isBankExist?.id })
                // const updateBankRes = 
                await updateBankaccountDao(
                  isBankExist?.id,
                  {
                    balance: bankdetails.balance + parseFloat(amount),
                    today_balance: bankdetails.balance + parseFloat(amount)
                  }
                );
                const notifyData = {
                  status: "BANK_MISMATCH",
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.confirmed,
                  req_amount: updatePayInDataRes?.amount,
                  utr_id: updatePayInDataRes?.user_submitted_utr
                };
                try {
                  //when we get the correct notify url;
                  const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                  console.log(notifyMerchant)
                } catch (error) {
                  console.log(error)
                }
                console.log('Bank Response created successfully', 'info');
                return updatePayInDataRes
              } else {
                `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}`

              }
            } else {
              const payInData = {
                confirmed: botRes?.amount,
                status: "BANK_MISMATCH",
                is_notified: true,
                user_submitted_utr: botRes?.utr,
                approved_at: new Date(),
              };

              const updatePayInDataRes = await updatePayInDao(
                checkPayInUtr[0]?.id,
                payInData
              );

              // const updateBotRes = 
              await updateBotResponseDao(botRes?.id, { is_used: true })
              // We are adding the amount to the bank as we want to update the balance of the bank
              const bankdetails = await getBankaccountDao({ id: isBankExist?.id })
              // const updateBankRes = 
              await updateBankaccountDao(
                isBankExist?.id,
                { balance: bankdetails.balance + parseFloat(amount) }
              );

              const notifyData = {
                status: "BANK_MISMATCH",
                merchantOrderId: updatePayInDataRes?.merchant_order_id,
                payinId: updatePayInDataRes?.id,
                amount: updatePayInDataRes?.confirmed,
                req_amount: updatePayInDataRes?.amount,
                utr_id: updatePayInDataRes?.user_submitted_utr
              };

              try {
                //when we get the correct notify url;
                // const notifyMerchant = 
                await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
              } catch (error) {
                console.log(error)

              }
              return updatePayInDataRes

            }
          }


          // check if duplicate and return error
          const existingResponse = await getBankResponseDao({ utr: utr, is_used: true })
          if (existingResponse?.length > 0) {
            throw new CustomError(400, "The UTR already exists");
          }
          const getMerchantToGetPayinCommissionRes = await getMerchantsDao({ id: checkPayInUtr[0]?.merchant_id })
          const payinMerchantCommission = calculateCommission(botRes?.amount, getMerchantToGetPayinCommissionRes?.payin_merchant_commission);
          const bankAccountDetails = await getBankaccountDao({ id: checkPayInUtr[0].bank_acc_id })
          const getVendorToGetPayinComission = await getVendorsDao({ id: bankAccountDetails.user_id })
          const payinVendorCommission = calculateCommission(botRes?.amount, getVendorToGetPayinComission?.payin_vendor_commission);

          const durMs = new Date() - checkPayInUtr.at(0)?.created_at;
          const durSeconds = Math.floor((durMs / 1000) % 60).toString().padStart(2, '0');
          const durMinutes = Math.floor((durSeconds / 60) % 60).toString().padStart(2, '0');
          const durHours = Math.floor((durMinutes / 60) % 24).toString().padStart(2, '0');
          const duration = `${durHours}:${durMinutes}:${durSeconds}`;

          if (checkPayInUtr.at(0)?.amount == amount
          ) {
            if (checkPayInUtr.at(0)?.user_submitted_utr) {
              if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                const payInData = {
                  confirmed: botRes?.amount,
                  status: "SUCCESS",
                  is_notified: true,
                  user_submitted_utr: botRes?.utr || checkPayInUtr.at(0)?.user_submitted_utr,
                  approved_at: new Date(),
                  duration: duration,
                  payin_merchant_commission: payinMerchantCommission,
                  payin_vendor_commission: payinVendorCommission
                };

                const updatePayInDataRes = await updatePayInDao(
                  checkPayInUtr[0]?.id,
                  payInData
                );

                if (checkPayInUtr[0]?.bank_acc_id) {
                  const bankdetails = await getBankaccountDao({ id: isBankExist?.id })
                  // const updateBankRes = 
                  await updateBankaccountDao(
                    checkPayInUtr[0]?.bank_acc_id,
                    {
                      balance: bankdetails.balance + parseFloat(amount),
                      today_balance: bankdetails.balance + parseFloat(amount)
                    }
                  );
                }

                // const updateBotRes = 
                await updateBotResponseDao(botRes?.id, { is_used: true })
                const merchatnData = await getMerchantsDao({ id: checkPayInUtr[0]?.merchant_id })
                // const updateMerchantData = 
                await updateMerchantDao(checkPayInUtr[0]?.merchant_id, { balance: merchatnData.balance + parseFloat(amount) })
                const notifyData = {
                  status: "SUCCESS",
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.confirmed,
                  utr_id: updatePayInDataRes?.user_submitted_utr
                };
                try {
                  //when we get the correct notify url;
                  // const notifyMerchant = 
                  await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                } catch (error) {
                  console.log(error)

                }
              } else {
                return `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}`

              }
            } else {
              const payInData = {
                confirmed: botRes?.amount,
                status: "SUCCESS",
                is_notified: true,
                user_submitted_utr: botRes?.utr || checkPayInUtr.at(0)?.user_submitted_utr,
                approved_at: new Date(),
                duration: duration,
                payin_merchant_commission: payinMerchantCommission,
                payin_mvendor_commission: payinVendorCommission,
              };

              const updatePayInDataRes = await updatePayInDao(
                checkPayInUtr[0]?.id,
                payInData
              );

              if (checkPayInUtr[0]?.bank_acc_id) {
                const bankdetails = await getBankaccountDao({ id: isBankExist?.id })

                // const updateBankRes = 
                await updateBankaccountDao(
                  checkPayInUtr[0]?.bank_acc_id,
                  {
                    balance: bankdetails.balance + parseFloat(amount),
                    today_balance: bankdetails.balance + parseFloat(amount)
                  }
                );
              }
              // const updateBotRes = 
              await updateBotResponseDao(botRes?.id, { is_used: true })
              const merchatnData = await getMerchantsDao({ id: checkPayInUtr[0]?.merchant_id })
              // const updateMerchantData = 
              await updateMerchantDao(checkPayInUtr[0]?.merchant_id, { balance: merchatnData.balance + parseFloat(amount) })
              const notifyData = {
                status: "SUCCESS",
                merchantOrderId: updatePayInDataRes?.merchant_order_id,
                payinId: updatePayInDataRes?.id,
                amount: updatePayInDataRes?.confirmed,
                utr_id: updatePayInDataRes?.user_submitted_utr
              };
              try {
                //when we get the correct notify url;
                // const notifyMerchant = 
                await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
              } catch (error) {
                console.log(error)
              }
            }
          }
          else {
            if (checkPayInUtr.at(0)?.user_submitted_utr) {
              if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                const payInData = {
                  confirmed: botRes?.amount,
                  status: "DISPUTE",
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  approved_at: new Date(),
                  duration: duration,
                  payin_merchant_commission: payinMerchantCommission,
                  payin_mvendor_commission: payinVendorCommission,

                };
                const updatePayInDataRes = await updatePayInDao(
                  checkPayInUtr[0]?.id,
                  payInData
                );
                const bankdetails = await getBankaccountDao({ id: isBankExist?.id })

                // const updateBankRes = 
                await updateBankaccountDao(
                  checkPayInUtr[0]?.bank_acc_id,
                  {
                    balance: bankdetails.balance + parseFloat(amount),
                    today_balance: bankdetails.balance + parseFloat(amount)
                  }
                );
                // const updateBotRes = 
                await updateBotResponseDao(botRes?.id, { is_used: true });
                const notifyData = {
                  status: "DISPUTE",
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.confirmed,
                  req_amount: updatePayInDataRes?.amount,
                  utr_id: updatePayInDataRes?.user_submitted_utr
                };

                try {
                  //when we get the correct notify url;
                  // const notifyMerchant = 
                  await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                } catch (error) {
                  console.log(error)
                }
              } else {
                return `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}`

              }
            } else {
              const payInData = {
                confirmed: botRes?.amount,
                status: "DISPUTE",
                is_notified: true,
                user_submitted_utr: botRes?.utr,
                approved_at: new Date(),
                duration: duration,
                payin_merchant_commission: payinMerchantCommission,
                payin_mvendor_commission: payinVendorCommission,
              };
              const updatePayInDataRes = await updatePayInDao(
                checkPayInUtr[0]?.id,
                payInData
              );
              const bankdetails = await getBankaccountDao({ id: isBankExist?.id })
              // const updateBankRes = 
              await updateBankaccountDao(
                checkPayInUtr[0]?.bank_acc_id,
                {
                  balance: bankdetails.balance + parseFloat(amount),
                  today_balance: bankdetails.balance + parseFloat(amount)
                }
              );

              // const updateBotRes
              await updateBotResponseDao(botRes?.id, { is_used: true });
              const notifyData = {
                status: "DISPUTE",
                merchantOrderId: updatePayInDataRes?.merchant_order_id,
                payinId: updatePayInDataRes?.id,
                amount: updatePayInDataRes?.confirmed,
                req_amount: updatePayInDataRes?.amount,
                utr_id: updatePayInDataRes?.user_submitted_utr
              };

              try {
                //when we get the correct notify url;
                // const notifyMerchant = 
                await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
              } catch (error) {
                console.log(error)
              }
            }
          }
        }

      }

      // Notify all connected clients about the new entry
      // io.emit("new-entry", {
      //   message: 'New entry added',
      //   data: updatedData
      // });

      return updatedData
    }

    else {
      return {
        message: "Invalid data received",
      };
    }
  } catch (error) {

    console.log('Error while creating Bank Response', 'error', error);
    throw new BadRequestError('Error occurred while creating Bank Response');
  }
}



const getBankResponseService = async (payload) => {
  try {
    const sno = !isNaN(Number(payload.sno)) ? Number(payload.sno) : 0;
    const status = payload.status || "";
    const amount = !isNaN(Number(payload.amount)) ? Number(payload.amount) : 0;
    const utr = payload.utr || "";
    const bank_id = payload.bank_id || "";
    // const page = parseInt(payload.page) || 1;
    // const pageSize = parseInt(payload.pageSize) || 10;
    const is_used = payload.is_used;
    // const skip = Math.max(0, (page - 1) * pageSize);
    // const take = Math.max(1, pageSize);

    // if (payload.is_used !== undefined) {
    //   filter.is_used = payload.is_used === 'Used' ? true : payload.is_used === 'Unused' ? false : true;
    // }
    let filters = {};

    if (sno > 0) filters.sno = sno;
    if (status) filters.status = status;
    if (amount > 0) filters.amount = amount;
    // if (amount_code) filters.amount_code = { contains: amount_code, mode: "insensitive" };
    if (utr) filters.utr = utr;
    if (bank_id) filters.bank_id = bank_id;
    if (is_used !== undefined) filters.is_used = is_used === 'Used' ? true : is_used === 'Unused' ? false : true;




    const data = await getBankResponseDaoAll({
      sno: filters.sno,
      status: filters.status,
      amount: filters.amount,
      utr: filters.utr,
      bank_id: filters.bank_id,
      is_used: filters.is_used
    });


    return data;
  } catch (error) {
    console.error('Error while updating BankResponse', 'error', error);
    throw new BadRequestError('Error occurred while Creating BankResponse');
  }
}


const getBankMessageServices = async (bank_id, startDate, endDate) => {

  try {
    const data = await getBankMessageDao( bank_id, startDate, endDate );
    return data;
  } catch (error) {
    console.error('Error while updating BankResponse', 'error', error);
    throw new BadRequestError('Error occurred while updating BankResponse');
  }
}


const resetBankResponseService = async (id, userData) => {
  try {
    const data = await resetBankResponseDao(id, userData);
    logger.log('Deleted BankResponse successfully', 'info');
    return data;
  } catch (error) {
    console.error('Error while updating BankResponse', 'error', error);
    throw new BadRequestError('Error occurred while updating BankResponse');
  }
}




export {
  getBankResponseService,
  createBankResponseService,
  getBankMessageServices, resetBankResponseService
}