import { BadRequestError, CustomError, } from '../../utils/appErrors.js';

import {
  getBankResponseDao,
  createBankResponseDao,
  getBankMessageDao, resetBankResponseDao,

  updateBotResponseDao,
  getBankResponseDaoAll
} from './bankResponseDao.js';
import Logger from '../../utils/logger.js';
import {  rollback } from '../../utils/db.js';
import { getBankaccountDao, updateBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getSettlementDao } from '../settlement/settlementDao.js';

import axios from 'axios';

import { getPayinsDao, updatePayInDao } from '../payIn/payInDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { calculateCommission } from '../../utils/calculation.js';
import config from '../../config/config.js';
// import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
// import { getBankaccountDao , updateBankaccountDao } from '../bankAccounts/bankaccountDao.js';
// import { getMerchantsDao } from '../merchants/merchantDao.js';
const logger = new Logger()

const createBankResponseService = async (payload) => {
  let conn;

  try {

    //updatePayInDataDao

    const splitData = payload.split(" ");
    const status = splitData[0];
    const amount = parseFloat(splitData[1]);
    const amount_code = splitData[2];
    const utr = splitData[3];
    const bank_id = splitData[4];
    const is_used = splitData[5];
    const created_by = splitData[6];
    const company_id = splitData[7];
 
    const isValidAmount = amount;
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

      let botRes
   

      const utrinternalTransfer = await getSettlementDao({ 
        "$config.reference_id$": utr,  
        method: ["INTERNAL_QR_TRANSFER" , "INTERNAL_BANK_TRANSFER"]
    });
    if (utrinternalTransfer) {
      const updatedData = {
        status: "/internalTransfer",
        amount: amount,
        utr: utr,
        bank_id: bank_id,
        is_used : false,
        created_by : created_by,
        company_id : company_id
      };
     
      botRes = await createBankResponseDao(updatedData);
      }
      else{
        botRes = await createBankResponseDao(updatedData);
      }


      if (updatedData.status === "REPEATED") {
        throw new CustomError(400, "Entry with REPEATED UTR Added")
      }


      const checkPayInUtr = await getPayinsDao(
        { user_submitted_utr: utr });
console.log(checkPayInUtr, "drftcgvhbjnik")
      if (checkPayInUtr?.length > 0) {
          console.log(checkPayInUtr, "yjtdxfcgvhgjk")
          let dataUtr = checkPayInUtr[0]?.utr ? checkPayInUtr[0]?.utr : checkPayInUtr[0]?.user_submitted_utr
          console.log(dataUtr, "rtdfgvhjn")
          const getDataByUtr = await getBankResponseDaoAll({ utr : dataUtr })
          console.log(getDataByUtr, "dtfyghjgetDataByUtr")
          const botUtrIsUsed = getDataByUtr?.some((item) => item.is_used);
          console.log(botUtrIsUsed, "kjhgf")

          if (acceptedStatus.includes(checkPayInUtr[0]?.status) && botUtrIsUsed) {
            throw new CustomError(400, `The entry is already ${checkPayInUtr[0]?.status} with ${dataUtr} UTR`);
          }
          
          else {
            console.log("dtcghvbjnkm")
            if (!botUtrIsUsed) { //! krna h
            console.log("liutyrdfgh")
              // We check bank exist here as we have to add the data to the res no matter what comes.          
              const isBankExist = await getBankaccountDao({id : bank_id})
              console.log( isBankExist, "iyutrrdxfcgvhjkmn")
            
              if (checkPayInUtr[0].bank_acc_id !== isBankExist?.id) {
                if (checkPayInUtr.at(0)?.user_submitted_utr) {
                  if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                    const payInData = {
                      amount: botRes?.amount,
                      status: "BANK_MISMATCH",
                      is_notified: true,
                      user_submitted_utr: botRes?.utr,
                      approved_at: new Date(),
                    };
                    console.log(checkPayInUtr[0]?.id,
                      payInData, "liuytresdfcgvhbjk")
                    const updatePayInDataRes = await updatePayInDao(
                      checkPayInUtr[0]?.id,
                      payInData
                    );
                    console.log(botRes, "ukyutyrdfcgvhbj")
                    const updateBotRes = await updateBotResponseDao( botRes.id, {is_used : true})
                    console.log(updateBotRes, "updateBotRes")


                    // We are adding the amount to the bank as we want to update the balance of the bank
                    const updateBankRes = await updateBankaccountDao(
                     { id: isBankExist.id,
                      balance : parseFloat(amount)}
                    );
                    console.log(updateBankRes, "updateBankRes")
                    const notifyData = {
                      status: "BANK_MISMATCH",
                      merchantOrderId: updatePayInDataRes?.merchant_order_id,
                      payinId: updatePayInDataRes?.id,
                      amount: updatePayInDataRes?.amount,
                      req_amount: updatePayInDataRes?.amount,
                      utr_id: updatePayInDataRes?.utr
                    };

                    try {
                      //when we get the correct notify url;
                      const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                      console.log(notifyMerchant, "3notifyMerchant")
                    } catch (error) {

                    }


                    return updateBankRes

                  } else {
                    return sendError(

                      `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}`
                    );
                  }
                } else {
                  const payInData = {
                    amount: botRes?.amount,
                    status: "BANK_MISMATCH",
                    is_notified: true,
                    user_submitted_utr: botRes?.utr,
                    approved_at: new Date(),
                  };

                  const updatePayInDataRes = await updatePayInDao(
                    checkPayInUtr[0]?.id,
                    payInData
                  );

                  const updateBotRes = await updateBotResponseDao(botRes?.id)
                  console.log(updateBotRes, "updateBotRes")

                  // We are adding the amount to the bank as we want to update the balance of the bank
                  const updateBankRes = await updateBankaccountDao(
                    isBankExist?.id,
                    {balance : parseFloat(amount)}
                  );
                  console.log(updateBankRes, "updateBankRes")
                  const notifyData = {
                    status: "BANK_MISMATCH",
                    merchantOrderId: updatePayInDataRes?.merchant_order_id,
                    payinId: updatePayInDataRes?.id,
                    amount: updatePayInDataRes?.amount,
                    req_amount: updatePayInDataRes?.amount,
                    utr_id: updatePayInDataRes?.utr
                  };

                  try {
                    //when we get the correct notify url;
                    const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                    console.log(notifyMerchant, "4notifyMerchant")
                  } catch (error) {
                  }
                  await commit(conn);
                  console.log('Bank Response created successfully', 'info');
                  await commit(conn);
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
              const getMerchantToGetPayinCommissionRes = await getMerchantsDao({id: checkPayInUtr[0]?.merchant_id})
              const payinCommission = calculateCommission(botRes?.amount, getMerchantToGetPayinCommissionRes?.payin_commission);

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
                      amount: botRes?.amount,
                      status: "SUCCESS",
                      is_notified: true,
                      user_submitted_utr: botRes?.utr || checkPayInUtr.at(0)?.user_submitted_utr,
                      // user_submitted_utr: checkPayInUtr.at(0)?.user_submitted_utr,
                      approved_at: new Date(),
                      duration: duration,
                      payin_commission: payinCommission
                    };

                    const updatePayInDataRes = await updatePayInDao(
                      checkPayInUtr[0]?.id,
                      payInData
                    );

                    if (checkPayInUtr[0]?.bank_acc_id) {
                      const updateBankRes = await updateBankaccountDao(
                        checkPayInUtr[0]?.bank_acc_id,
                        {balance : parseFloat(amount)}
                      );
                    }
                    const updateBotRes = await updateBotResponseDao(botRes?.id, {is_used : true})
                    console.log(updateBotRes, "updateBotRes")
                    const updateMerchantData = await getMerchantsDao(checkPayInUtr[0]?.merchant_id, {amount : amount})
                    const notifyData = {
                      status: "SUCCESS",
                      merchantOrderId: updatePayInDataRes?.merchant_order_id,
                      payinId: updatePayInDataRes?.id,
                      amount: updatePayInDataRes?.amount,
                      utr_id: updatePayInDataRes?.utr
                    };
                    console.log(updateMerchantData, "updateMerchantData")
                    try {
                      //when we get the correct notify url;
                      const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                      console.log(notifyMerchant, "5notifyMerchant")
                    } catch (error) {
                    }
                  } else {
                    return `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}`

                  }
                } else {
                  const payInData = {
                    amount: botRes?.amount,
                    status: "SUCCESS",
                    is_notified: true,
                    user_submitted_utr: botRes?.utr,
                    user_submitted_utr: checkPayInUtr.at(0)?.user_submitted_utr,
                    approved_at: new Date(),
                    duration: duration,
                    payin_commission: payinCommission
                  };

                  const updatePayInDataRes = await updatePayInDao(
                    checkPayInUtr[0]?.id,
                    payInData
                  );

                  if (checkPayInUtr[0]?.bank_acc_id) {
                    const updateBankRes = await updateBankaccountDao(
                      checkPayInUtr[0]?.bank_acc_id,
                      {balance : parseFloat(amount)}
                    );
                    console.log(updateBankRes, "updateBankRes")
                  }
                  // const updateBotRes = await updateBotResponseDao(botRes?.id)

                  const updateMerchantData = await getMerchantsDao(checkPayInUtr[0]?.merchant_id, amount)
                  console.log(updateMerchantData, "updateMerchantData")
                  const notifyData = {
                    status: "SUCCESS",
                    merchantOrderId: updatePayInDataRes?.merchant_order_id,
                    payinId: updatePayInDataRes?.id,
                    amount: updatePayInDataRes?.amount,
                    utr_id: updatePayInDataRes?.utr
                  };
                  try {
                    //when we get the correct notify url;
                    const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                    console.log(notifyMerchant, "6notifyMerchant")
                  } catch (error) {
                  }
                }
              }
              else {
                if (checkPayInUtr.at(0)?.user_submitted_utr) {
                  if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                    const payInData = {
                      amount: botRes?.amount,
                      status: "DISPUTE",
                      is_notified: true,
                      user_submitted_utr: botRes?.utr,
                      approved_at: new Date(),
                      duration: duration,
                      payin_commission: payinCommission
                    };
                    const updatePayInDataRes = await updatePayInDao(
                      checkPayInUtr[0]?.id,
                      payInData
                    );

                    const updateBankRes = await updateBankaccountDao (
                      checkPayInUtr[0]?.bank_acc_id,
                      {balance : parseFloat(amount)}
                    );
                    console.log(notifyMerchant, "7notifyMerchant")


                    const updateBotRes = await updateBotResponseDao(botRes?.id);
                    console.log(updateBotRes, "updateBotRes")
                    const notifyData = {
                      status: "DISPUTE",
                      merchantOrderId: updatePayInDataRes?.merchant_order_id,
                      payinId: updatePayInDataRes?.id,
                      amount: updatePayInDataRes?.amount,
                      req_amount: updatePayInDataRes?.amount,
                      utr_id: updatePayInDataRes?.utr
                    };

                    try {
                      //when we get the correct notify url;
                      const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                      console.log(notifyMerchant, "notifyMerchant")
                    } catch (error) {
                    }
                  } else {
                  return `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}`

                  }
                } else {
                  const payInData = {
                    amount: botRes?.amount,
                    status: "DISPUTE",
                    is_notified: true,
                    user_submitted_utr: botRes?.utr,
                    approved_at: new Date(),
                    duration: duration,
                    payin_commission: payinCommission
                  };
                  const updatePayInDataRes = await updatePayInDao(
                    checkPayInUtr[0]?.id,
                    payInData
                  );

                  const updateBankRes = await updateBankaccountDao(
                    checkPayInUtr[0]?.bank_acc_id,
                    {balance : parseFloat(amount)}
                  );
                  console.log(updateBankRes, "updateBankRes")


                  const updateBotRes = await updateBotResponseDao(botRes?.id);
                  console.log(updateBotRes, "updateBotRes")
                  const notifyData = {
                    status: "DISPUTE",
                    merchantOrderId: updatePayInDataRes?.merchant_order_id,
                    payinId: updatePayInDataRes?.id,
                    amount: updatePayInDataRes?.amount,
                    req_amount: updatePayInDataRes?.amount,
                    utr_id: updatePayInDataRes?.utr
                  };

                  try {
                    //when we get the correct notify url;
                    const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                  } catch (error) {
                  }
                }
              }
            }
          }
          
          if (!acceptedStatus.includes(checkPayInUtr[0]?.status)) {
            
            // We check bank exist here as we have to add the data to the res no matter what comes.
            const isBankExist = await getBankaccountDao({id : bank_id})
            console.log(isBankExist, "serdtfyghupdatePayInDataRes")
            if (!isBankExist) {
              if (checkPayInUtr.at(0)?.user_submitted_utr) {
                if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                  const payInData = {
                    amount: botRes?.amount,
                    status: "BANK_MISMATCH",
                    is_notified: true,
                    user_submitted_utr: botRes?.utr,
                    approved_at: new Date(),
                  };
                  const updatePayInDataRes = await updatePayInDao(
                    checkPayInUtr[0]?.id,
                    payInData
                  );

                  const updateBotRes = await updateBotResponseDao(botRes?.id)
                  console.log(updateBotRes, "updateBotRes")
                  // We are adding the amount to the bank as we want to update the balance of the bank
                  const updateBankRes = await updateBankaccountDao(
                    isBankExist?.id,
                   {balance :  parseFloat(amount)}
                  );
                  console.log(updateBankRes, "updateBankRes")

                  const notifyData = {
                    status: "BANK_MISMATCH",
                    merchantOrderId: updatePayInDataRes?.merchant_order_id,
                    payinId: updatePayInDataRes?.id,
                    amount: updatePayInDataRes?.amount,
                    req_amount: updatePayInDataRes?.amount,
                    utr_id: updatePayInDataRes?.utr
                  };

                  try {
                    //when we get the correct notify url;
                    const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                    console.log(notifyMerchant, "notifyMerchant")
                  } catch (error) {
                  }
                  await commit(conn);
                  console.log('Bank Response created successfully', 'info');

                  return updatePayInDataRes

                } else {
                  return sendError(


                    `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}`
                  );
                }
              } else {
                const payInData = {
                  amount: botRes?.amount,
                  status: "BANK_MISMATCH",
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  approved_at: new Date(),
                };

                const updatePayInDataRes = await updatePayInDao(
                  checkPayInUtr[0]?.id,
                  payInData
                );

                const updateBotRes = await updateBotResponseDao(botRes?.id)
                console.log(updateBotRes, "updateBotRes")
                // We are adding the amount to the bank as we want to update the balance of the bank
                const updateBankRes = await updateBankaccountDao(   
                  isBankExist?.id,
                 {balance :  parseFloat(amount)}
                );
                console.log(updateBankRes, "updateBankRes")


                const notifyData = {
                  status: "BANK_MISMATCH",
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.amount,
                  req_amount: updatePayInDataRes?.amount,
                  utr_id: updatePayInDataRes?.utr
                };

                try {
                  //when we get the correct notify url;
                  const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                  console.log(notifyMerchant)
                } catch (error) {
                }
                await commit(conn);
                console.log('Bank Response created successfully', 'info');

                return updatePayInDataRes

              }
            }

            // if (isBankExist?.Merchant_Bank.length === 1) {

            if (checkPayInUtr[0].bank_acc_id !== isBankExist?.id) {
              console.log(checkPayInUtr[0],"iuytdrsdxfcgvhb")
              if (checkPayInUtr.at(0)?.user_submitted_utr) {
                if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                  const payInData = {
                    amount: botRes?.amount,
                    status: "BANK_MISMATCH",
                    is_notified: true,
                    user_submitted_utr: botRes?.utr,
                    approved_at: new Date(),
                  };

                  const updatePayInDataRes = await updatePayInDao(
                    checkPayInUtr[0]?.id,
                    payInData
                  );

                  const updateBotRes = await updateBotResponseDao(botRes?.id)
                  console.log(updateBotRes)
                  // We are adding the amount to the bank as we want to update the balance of the bank
                  // const updateBankRes = await updateBankaccountDao(
                  //   isBankExist?.id,
                  //   parseFloat(amount)
                  // );

                  const notifyData = {
                    status: "BANK_MISMATCH",
                    merchantOrderId: updatePayInDataRes?.merchant_order_id,
                    payinId: updatePayInDataRes?.id,
                    amount: updatePayInDataRes?.amount,
                    req_amount: updatePayInDataRes?.amount,
                    utr_id: updatePayInDataRes?.utr
                  };

                  try {
                    //when we get the correct notify url;
                    const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                    console.log(notifyMerchant)
                  } catch (error) {
                  }
                  await commit(conn);
                  console.log('Bank Response created successfully', 'info');

                  return updatePayInDataRes

                } else {
                  return sendError(


                    `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}`
                  );
                }
              } else {
                const payInData = {
                  amount: botRes?.amount,
                  status: "BANK_MISMATCH",
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  approved_at: new Date(),
                };

                const updatePayInDataRes = await updatePayInDao(
                  checkPayInUtr[0]?.id,
                  payInData
                );

                const updateBotRes = await updateBotResponseDao(botRes?.id)
                console.log(updateBotRes)
                // We are adding the amount to the bank as we want to update the balance of the bank
                // const updateBankRes = await updateBankaccountDao(
                //   isBankExist?.id,
                //   parseFloat(amount)
                // );

                const notifyData = {
                  status: "BANK_MISMATCH",
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.amount,
                  req_amount: updatePayInDataRes?.amount,
                  utr_id: updatePayInDataRes?.utr
                };

                try {
                  //when we get the correct notify url;
                  const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                  console.log(notifyMerchant)
                } catch (error) {
                }
                await commit(conn);
                console.log('Bank Response created successfully', 'info');

                return updatePayInDataRes

              }
            }

            // }

            // check if duplicate and return error
            const existingResponse = await getBankResponseDao({ utr: utr, is_used: true })


            if (existingResponse?.length > 0) {
              throw new CustomError(400, "The UTR already exists");
            }
            const getMerchantToGetPayinCommissionRes = await getMerchantsDao({id : checkPayInUtr[0]?.merchant_id})
            const payinCommission = calculateCommission(botRes?.amount, getMerchantToGetPayinCommissionRes?.payin_commission);

            const durMs = new Date() - checkPayInUtr.at(0)?.createdAt;
            const durSeconds = Math.floor((durMs / 1000) % 60).toString().padStart(2, '0');
            const durMinutes = Math.floor((durSeconds / 60) % 60).toString().padStart(2, '0');
            const durHours = Math.floor((durMinutes / 60) % 24).toString().padStart(2, '0');
            const duration = `${durHours}:${durMinutes}:${durSeconds}`;

            if (checkPayInUtr.at(0)?.amount == amount
            ) {
              if (checkPayInUtr.at(0)?.user_submitted_utr) {
                if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                  const payInData = {
                    amount: botRes?.amount,
                    status: "SUCCESS",
                    is_notified: true,
                    user_submitted_utr: botRes?.utr,
                    user_submitted_utr: checkPayInUtr.at(0)?.user_submitted_utr,
                    approved_at: new Date(),
                    duration: duration,
                    payin_commission: payinCommission
                  };

                  const updatePayInDataRes = await updatePayInDao(
                    checkPayInUtr[0]?.id,
                    payInData
                  );

                  if (checkPayInUtr[0]?.bank_acc_id) {
                    const updateBankRes = await updateBankaccountDao(
                      checkPayInUtr[0]?.bank_acc_id,
                      {balance : parseFloat(amount)}
                    );
                    console.log(updateBankRes)
                  }

                  const updateBotRes = await updateBotResponseDao(botRes?.id)
                  console.log(updateBotRes)
                  const updateMerchantData = await getMerchantsDao(checkPayInUtr[0]?.merchant_id, amount)
                  console.log(updateMerchantData)
                  const notifyData = {
                    status: "SUCCESS",
                    merchantOrderId: updatePayInDataRes?.merchant_order_id,
                    payinId: updatePayInDataRes?.id,
                    amount: updatePayInDataRes?.amount,
                    utr_id: updatePayInDataRes?.utr
                  };
                  try {
                    //when we get the correct notify url;
                    const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                  } catch (error) {
                  }
                } else {
                  await commit(conn);
                  console.log('Bank Response created successfully', 'info');

                  return sendError(


                    `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}`
                  );
                }
              } else {
                const payInData = {
                  amount: botRes?.amount,
                  status: "SUCCESS",
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  user_submitted_utr: checkPayInUtr.at(0)?.user_submitted_utr,
                  approved_at: new Date(),
                  duration: duration,
                  payin_commission: payinCommission
                };

                const updatePayInDataRes = await updatePayInDao(
                  checkPayInUtr[0]?.id,
                  payInData
                );

                if (checkPayInUtr[0]?.bank_acc_id) {
                  const updateBankRes = await updateBankaccountDao(
                    checkPayInUtr[0]?.bank_acc_id,
                    {balance : parseFloat(amount)}
                  );
                }
                const updateBotRes = await updateBotResponseDao(botRes?.id)
                console.log(updateBotRes)
                const updateMerchantData = await getMerchantsDao(checkPayInUtr[0]?.merchant_id, amount)
                console.log(updateMerchantData)
                const notifyData = {
                  status: "SUCCESS",
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.amount,
                  utr_id: updatePayInDataRes?.utr
                };
                try {
                  //when we get the correct notify url;
                  const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                  console.log(notifyMerchant)
                } catch (error) {
                }
              }
            }
            else {
              if (checkPayInUtr.at(0)?.user_submitted_utr) {
                if (checkPayInUtr.at(0)?.user_submitted_utr == utr) {
                  const payInData = {
                    amount: botRes?.amount,
                    status: "DISPUTE",
                    is_notified: true,
                    user_submitted_utr: botRes?.utr,
                    approved_at: new Date(),
                    duration: duration,
                    payin_commission: payinCommission
                  };
                  const updatePayInDataRes = await updatePayInDao(
                    checkPayInUtr[0]?.id,
                    payInData
                  );

                  const updateBankRes = await updateBankaccountDao(
                    checkPayInUtr[0]?.bank_acc_id,
                    {balance : parseFloat(amount)}
                  );
                  console.log(updateBankRes)


                  const updateBotRes = await updateBotResponseDao(botRes?.id);
                  console.log(updateBotRes)
                  const notifyData = {
                    status: "DISPUTE",
                    merchantOrderId: updatePayInDataRes?.merchant_order_id,
                    payinId: updatePayInDataRes?.id,
                    amount: updatePayInDataRes?.amount,
                    req_amount: updatePayInDataRes?.amount,
                    utr_id: updatePayInDataRes?.utr
                  };

                  try {
                    //when we get the correct notify url;
                    const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                  } catch (error) {
                  }
                } else {
                  await commit(conn);
                  console.log('Bank Response created successfully', 'info');

                  return sendError(


                    `⛔ UTR: ${utr} does not match with User Submitted UTR: ${checkPayInUtr.at(0)?.user_submitted_utr}`
                  );
                }
              } else {
                const payInData = {
                  amount: botRes?.amount,
                  status: "DISPUTE",
                  is_notified: true,
                  user_submitted_utr: botRes?.utr,
                  approved_at: new Date(),
                  duration: duration,
                  payin_commission: payinCommission
                };
                const updatePayInDataRes = await updatePayInDao(
                  checkPayInUtr[0]?.id,
                  payInData
                );

                const updateBankRes = await updateBankaccountDao(
                  checkPayInUtr[0]?.bank_acc_id,
                  {balance : parseFloat(amount)}
                );
                console.log(updateBankRes)


                const updateBotRes = await updateBotResponseDao(botRes?.id);
                console.log(updateBotRes)
                const notifyData = {
                  status: "DISPUTE",
                  merchantOrderId: updatePayInDataRes?.merchant_order_id,
                  payinId: updatePayInDataRes?.id,
                  amount: updatePayInDataRes?.amount,
                  req_amount: updatePayInDataRes?.amount,
                  utr_id: updatePayInDataRes?.utr
                };

                try {
                  //when we get the correct notify url;
                  const notifyMerchant = await axios.post(checkPayInUtr[0]?.notify_url, notifyData)
                } catch (error) {
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


      await createBankResponseDao(updatedData)   
      return updatedData
    }


    else {
      return {
  
        message: "Invalid data received",
      };
    }
  } catch (error) {
    if (conn) {
     
        console.log('Error during transaction rollback', 'error', rollbackError);
      
    }
    console.log('Error while creating Bank Response', 'error', error);
    throw new BadRequestError('Error occurred while creating Bank Response');
  } finally {
    if (conn) {
      
        console.log('Error while releasing the connection', 'error', releaseError);
      
    }
  }
}



const getBankResponseService = async (payload) => {
  try {
    const sno = !isNaN(Number(payload.sno)) ? Number(payload.sno) : 0;
    const status = payload.status || "";
    const amount = !isNaN(Number(payload.amount)) ? Number(payload.amount) : 0;
    const utr = payload.utr || "";
    const bank_id = payload.bank_id || "";
    const page = parseInt(payload.page) || 1;
    const pageSize = parseInt(payload.pageSize) || 10;
    const is_used = payload.is_used;
    const skip = Math.max(0, (page - 1) * pageSize);
    const take = Math.max(1, pageSize);

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




    const data = await getBankResponseDao({
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
    const data = await getBankMessageDao({ bank_id: bank_id });
    return data;
  } catch (error) {
    logger.error('Error while updating BankResponse', 'error', error);
    throw new BadRequestError('Error occurred while updating BankResponse');
  }
}


const resetBankResponseService = async (id, userData) => {
  try {
    const data = await resetBankResponseDao(id, userData);
    logger.log('Deleted BankResponse successfully', 'info');
    return data;
  } catch (error) {
    logger.error('Error while updating BankResponse', 'error', error);
    throw new BadRequestError('Error occurred while updating BankResponse');
  }
}




export {
  getBankResponseService,
  createBankResponseService,
  getBankMessageServices, resetBankResponseService
}