// import cron from 'node-cron';
// import moment from 'moment-timezone';
// import { getPayInCronDao } from '../apis/payIn/payInDao.js';
// import { getbotResDao } from '../apis/botRes/botResDao.js';
// import { Status } from '../constants';
// import { merchantPayinCallback } from '../callBacksAndWebHook/merchantCallBacks.js';
// import { updateBotResponseDao } from '../apis/botRes/botResDao.js';
// import { updatePayInUrlDao } from '../apis/payIn/payInDao.js';
// import { getMerchantsDao } from '../apis/merchants/merchantDao';
// import { calculateCommission } from '../../utils/calculation.js';
// import { getVendorsDao } from '../apis/vendors/vendorDao';
// import {
//   getBankaccountDao
// } from '../bankAccounts/bankaccountDao.js';cron.schedule(
//   '*/10 * * * * *',
//   () => {
//     checkPendingStatus('Asia/Kolkata');
//   },
//   {
//     timezone: 'Asia/Kolkata',
//   },
// );

// const checkPendingStatus = async (timezone = 'Asia/Kolkata') => {
//   const currentTime = moment().tz(timezone);
//   const startDate = currentTime.clone().subtract(10, 'minutes').toDate();
//   const endDate = currentTime.toDate();
//   const formattedTime = currentTime.format();

//   console.info(`Checking pending status at ${formattedTime}`);

//   try {
//     // Fetch PENDING payins from the last 50 minutes
//     const payinFilters = { status: 'PENDING' };
//     const payin = await getPayInCronDao(payinFilters, startDate, endDate);
//     // Ensure payins is an array before iterating
//     // Process each payin
//       // Fetch bank responses with is_used: false and status containing "success"
//       const botResFilters = {
//         is_used: false,
//         status: '/success',
//         utr: payin.user_submitted_utr,
//       };
//       const botRes = await getbotResDao(
//         botResFilters,
//         startDate,
//         endDate,
//       );
//       console.log(botRes,"hey bank");
//       // If bank response exists, perform checks
//       if (botRes) {
//            const bankdetails = await getBankaccountDao(
//              {
//                id: botRes?.bank_id,
//              },);
//           const merchantData = await getMerchantsDao(
//             { id: payin.merchant_id },
//           );
//           const payinMerchantCommission = calculateCommission(
//                 botRes.amount,
//                 merchantData[0].payin_commission,
//           );
//           const vendor = await getVendorsDao({
//             user_id: bankdetails[0].user_id,
//           });
//           const payinVendorCommission = calculateCommission(
//                 botRes.amount,
//                 vendor[0].payin_commission,
//               );
//         // Check if bank_id matches
//           if (payin.bank_acc_id !== botRes.bank_id) {
//              const payInData = {
//                status: Status.BANK_MISMATCH,
//                is_notified: true,
//                user_submitted_utr: botRes.utr,
//                bank_response_id: botRes.id,
//                approved_at: new Date(),
//                // config: { from_UI },
//              };
//              const updatePayInDataRes = await updatePayInUrlDao(
//                payin.id,
//                payInData,
//              );
//              await updateBotResponseDao(botRes.id, { is_used: true });
//              if (updatePayInDataRes) {
//                merchantPayinCallback(updatePayInDataRes.config.urls?.notify, {
//                  status: updatePayInDataRes.status,
//                  merchantOrderId: updatePayInDataRes.merchant_order_id,
//                  payinId: updatePayInDataRes.id,
//                  amount: botRes.amount,
//                  req_amount: updatePayInDataRes.amount,
//                  utr_id: updatePayInDataRes.utr,
//                });
//              }
//           console.warn(`Bank mismatch for payin ${payin.id || 'unknown'}:`, {
//             payin_bank_id: payin.bank_acc_id,
//             bank_response_bank_id: botRes.bank_id,
//           });
//         }

//         // Check if amount matches
//           if (payin.amount !== botRes.amount) {
//              const payInData = {
//                status: Status.DISPUTE,
//                is_notified: true,
//                user_submitted_utr: botRes.utr,
//                bank_response_id: botRes.id,
//                approved_at: new Date(),
//                duration,
//                payin_merchant_commission: payinMerchantCommission,
//                payin_vendor_commission: payinVendorCommission,
//                // config: { from_UI },
//              };
//              const updatePayInDataRes = await updatePayInUrlDao(
//                payin.id,
//                payInData,
//              );
//              await updateBotResponseDao(botRes.id, { is_used: true });
//              if (updatePayInDataRes) {
//                merchantPayinCallback(updatePayInDataRes.config.urls?.notify, {
//                  status: updatePayInDataRes.status,
//                  merchantOrderId: updatePayInDataRes.merchant_order_id,
//                  payinId: updatePayInDataRes.id,
//                  amount: botRes.amount,
//                  req_amount: updatePayInDataRes.amount,
//                  utr_id: updatePayInDataRes.utr,
//                });
//              }
//           console.warn(`Amount dispute for payin ${payin.id || 'unknown'}:`, {
//             payin_amount: payin.amount,
//             bank_response_amount: botRes.amount,
//           });
//         }

//         // If both checks pass, you can add further processing here
//         console.info(`Valid match found for payin ${payin.id || 'unknown'}`);
      
//     }
//   } catch (error) {
//     console.error('Error in checkPendingStatus:', error.message);
//   }
// };

// export default checkPendingStatus;
