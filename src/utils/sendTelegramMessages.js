import { getBankResponseDao } from '../apis/bankResponse/bankResponseDao.js';
import { createTelegramSender } from '../helpers/telegramApi.js';
import { logger } from './logger.js';

const telegramSender = createTelegramSender();


export async function sendTelegramDashboardReportMessage(
  chatId,
  merchant,
  totalpayinsMerchant,
  totalpayoutsMerchant,
  vendorObjpayIn,
  vendorObjpayOut,
  totalBankDepositAllVendors,
  totalBankWithdrawalAllVendors,
  TELEGRAM_BOT_TOKEN,
  type,
) {
  const currentDate = new Date().toISOString().split('T')[0];
  const now = new Date();
  const istTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  let startHour = istTime.getHours() - 1;
  let endHour = (startHour + 1) % 24;

  const startAmpm = startHour >= 12 ? "PM" : "AM";
  const endAmpm = endHour >= 12 ? "PM" : "AM";

  // Convert hours to 12-hour format
  startHour = startHour % 12 || 12;
  endHour = endHour % 12 || 12;

  const formattedTime = `${startHour}${startAmpm}-${endHour}${endAmpm}`;
  const timeStamp =
    type === "Hourly Report" ? formattedTime :
      currentDate;

  const merchantPayInDetails = merchant
    .map(
      (m) =>
        `${m.merchantId}: ₹ ${m.totalPayin.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} (${m.totalPayinCount})`
    )
    .join('\n');

    const merchantPayOutDetails = merchant
    .map(
      (m) =>
        `${m.merchantId}: ₹ ${m.totalPayout.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} (${m.totalPayoutCount})`
    )
    .join('\n'); 

  const vendorDetails = Object.entries(vendorObjpayIn)
  // .filter(([_, { banks }]) => banks.length > 0) 
    .map(([vendorCode, { banks }]) => {
      // if (banks.length === 0) {
      //   return `<b>${vendorCode}</b>: No bank accounts`;
      // }
      const bankDetails = banks
      .filter((bank) => bank.TotalDeposit !== null) 
      .map(
        (bank) =>
          `  ${bank.bankName}: ₹ ${bank.TotalDeposit.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} (${bank.TotalCount})`
        )
        .join('\n');
      return `<b>${vendorCode}</b>:\n${bankDetails}`;
    })
    .join('\n\n');

  const vendorDetailsPayout = Object.entries(vendorObjpayOut)
  // .filter(([_, { banks }]) => banks.length > 0) 
    .map(([vendorCode, { banks }]) => {
      // if (banks.length === 0) {
      //   return `<b>${vendorCode}</b>: No bank accounts`;
      // }
      const bankDetails = banks
      .filter((bank) => bank.TotalDeposit !== null || bank.TotalDeposit !== 0) 
      .map(
        (bank) =>
          `  ${bank.bankName}: ₹ ${bank.TotalDeposit.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} (${bank.TotalCount})`
        )
        .join('\n');
      return `<b>${vendorCode}</b>:\n${bankDetails}`;
    })
    .join('\n\n');

    const message = `
    <b>(${timeStamp}) IST</b>
    
<b>💰 Deposits</b>

${merchantPayInDetails}
    
<b>Total Deposits:</b> ₹ ${totalpayinsMerchant}
    
<b>🏦 Withdrawals</b>

${merchantPayOutDetails}
    
<b>Total Withdrawals:</b> ₹ ${totalpayoutsMerchant}
    
<b>✅ Bank Account Deposits</b>

${vendorDetails}
    
<b>Total Bank Account Deposits:</b> ₹ ${totalBankDepositAllVendors}
    
<b>✅ Bank Account Withdrawals</b>

${vendorDetailsPayout}
    
<b>Total Bank Account Withdrawals:</b> ₹ ${totalBankWithdrawalAllVendors}
`;

  const success = await telegramSender(chatId, message, null, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendTelegramDashboardMerchantGroupingReportMessage(
  chatId,
  totalPayInSum,
  totalPayOutSum,
  totalPayInCount,
  totalPayOutCount,
  totalPayinsMerchant,
  merchantTotalPayout,
  TELEGRAM_BOT_TOKEN,
  // type,
) {
  const currentDate = new Date().toISOString().split('T')[0];
  // const now = new Date();
  // const istTime = new Date(
  //   now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  // );

  // let startHour = istTime.getHours() - 1;
  // let endHour = (startHour + 1) % 24; // Wrap around if it's 23 (to handle midnight)

  // const startAmpm = startHour >= 12 ? "PM" : "AM";
  // const endAmpm = endHour >= 12 ? "PM" : "AM";

  // Convert hours to 12-hour format
  // startHour = startHour % 12 || 12;
  // endHour = endHour % 12 || 12;

  //   const merchantAllPayinDetails = totalPayinsMerchant.map(m =>
  //     `<b>Merchant:</b> ${m.merchantId} | <b>PayIn:</b> ${m.totalPayIn} | <b>Count:</b> ${m.totalPayInEachCount}`
  // ).join("\n");
  const merchantAllPayinDetails = (Array.isArray(totalPayinsMerchant) ? totalPayinsMerchant : [])
    .map(
      (m) =>
        `<b>Merchant:</b> ${m.merchantId} | <b>PayIn:</b> ${m.totalPayIn} | <b>Count:</b> ${m.totalPayInEachCount}`,
    )
    .join('\n');
  const merchantAllPayOutDetails = (merchantTotalPayout || [])
    .map(
      (m) =>
        `<b>Merchant:</b> ${m.merchantId} | <b>PayOut:</b> ${m.totalPayOutSum} | <b>Count:</b> ${m.totalPayOutCount}`,
    )
    .join('\n');

  // const formattedTime = `${startHour}${startAmpm}-${endHour}${endAmpm}`;
  const timeStamp =
    //  type === "Hourly Report" ? formattedTime :
    currentDate;

  const message = `
  <b>

  (${timeStamp}) IST</b>
  
  <b>💰 Deposits</b>
    <b>✅ Sub-Merchant-wise PayIn Details</b>${merchantAllPayinDetails}

  <b>Total Deposits:</b> ${totalPayInSum}
  <b>Total Deposits Count:</b> ${totalPayInCount}
  
  <b>🏦 Withdrawals</b>
    <b>✅ Sub-Merchant-wise PayIn Details</b>${merchantAllPayOutDetails}

  <b>Total Withdrawals:</b> ${totalPayOutSum}
    <b>Total Withdrawals Count:</b> ${totalPayOutCount}

  <b>✅ Bank Account Deposits</b>

  <b>Total Bank Account Deposits:</b> ${merchantAllPayinDetails}
  
  <b>✅ Bank Account Withdrawals</b>

  <b>Total Bank Account Withdrawals:</b> ${merchantAllPayOutDetails}
      `;

  const success = await telegramSender(chatId, message, null, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendTelegramDashboardSuccessRatioMessage(
  chatId,
  // merchantCode,
  fullMessage,
  TELEGRAM_BOT_TOKEN
) {
  const message = fullMessage
    .map(({ merchantCode, intervalDetails, intervalDetailsUtr }) => {
      return `🔔<b>${merchantCode}</b> - SR 🔔\n\n<b>Payin SR:</b>\n${intervalDetails}\n\n<b>UTR SR:</b>\n${intervalDetailsUtr}`;
    })
    .join('\n\n');

  const success = await telegramSender(chatId, message, null, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendTelegramMessage(
  chatId,
  data,
  TELEGRAM_BOT_TOKEN,
  replyToMessageId,
) {
  const message = `
      <b>UPI-AMOUNT:</b> ${data?.amount}
      <b>UTR-IDS:</b> ${data?.utr}
      <b>Time Stamp:</b> ${data?.timeStamp}
    `;
  const success = await telegramSender(chatId, message, replyToMessageId, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendErrorMessageUtrOrAmountNotFoundImgTelegramBot(
  chatId,
  TELEGRAM_BOT_TOKEN,
  replyToMessageId,
) {
  // Construct the error message
  const message = `⛔ Please check this slip `;

  const success = await telegramSender(chatId, message, replyToMessageId, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendErrorMessageNoMerchantOrderIdFoundTelegramBot(
  chatId,
  TELEGRAM_BOT_TOKEN,
  replyToMessageId,
  withoutImage,
) {
  // Construct the error message
  let message;
  if (withoutImage) {
    message = `⛔ Please mention Merchant Order Id in Caption`;
  } else {
    message = `⛔ Please mention Merchant Order Id`; // If withoutImage is true, set this message
  }

  const success = await telegramSender(chatId, message, replyToMessageId, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendErrorMessageTelegram(
  chatId,
  merchantOrderIdTele,
  TELEGRAM_BOT_TOKEN,
  replyToMessageId,
) {
  // Construct the error message
  const message = `⛔ No Merchant Order ID ${merchantOrderIdTele} found. Please recheck input`;

  const success = await telegramSender(chatId, message, replyToMessageId, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendUTRMismatchErrorMessageTelegram(
  chatId,
  utr,
  userSubmittedUtr,
  TELEGRAM_BOT_TOKEN,
  replyToMessageId,
) {
  // Construct the error message
  const message = `⛔ UTR - ${utr} does not match with the UTR submitted by the user - ${userSubmittedUtr}`;

  const success = await telegramSender(chatId, message, replyToMessageId, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendErrorMessageNoDepositFoundTelegramBot(
  chatId,
  Utr,
  TELEGRAM_BOT_TOKEN,
  replyToMessageId,
) {
  // Construct the error message
  const message = `⛔ No deposit with UTR ${Utr} found. Please check  `;

  const success = await telegramSender(chatId, message, replyToMessageId, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendSuccessMessageTelegramBot(
  chatId,
  merchantOrderId,
  TELEGRAM_BOT_TOKEN,
  replyToMessageId,
) {
  // Construct the error message
  let message = `💵 Order No. ${merchantOrderId} is confirmed! ✅`;

  const success = await telegramSender(chatId, message, replyToMessageId, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendDisputeMessageTelegramBot(
  chatId,
  disputedAmount,
  amount,
  TELEGRAM_BOT_TOKEN,
  replyToMessageId,
) {
  // Construct the error message
  let message = `
              AMOUNT DISPUTED: 
                    ⛔ Requested Amount: ${disputedAmount}
                    ✅ Received Amount: ${amount}
            `;

  const success = await telegramSender(chatId, message, replyToMessageId, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendDuplicateMessageTelegramBot(
  chatId,
  utr,
  merchantOrderId,
  TELEGRAM_BOT_TOKEN,
  replyToMessageId,
) {
  // Construct the error message
  let message = `🚨 OrderId ${merchantOrderId} is Duplicate as UTR ${utr} is already confirmed with `;

  const success = await telegramSender(chatId, message, replyToMessageId, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendBankMismatchMessageTelegramBot(
  chatId,
  bankNameFromMerchant,
  bankNameFromBank,
  TELEGRAM_BOT_TOKEN,
  replyToMessageId,
) {
  // Construct the error message
  let message = `
              BANK MISMATCH :
                  ⛔ Amount should be credited in : ${bankNameFromMerchant}
                  ✅ Amount credited in : ${bankNameFromBank}
            `;

  const success = await telegramSender(chatId, message, replyToMessageId, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendAlreadyConfirmedMessageTelegramBot(
  chatId,
  utr,
  TELEGRAM_BOT_TOKEN,
  replyToMessageId,
  existingPayinData,
  getPayInData,
) {
  let payinData = {};
  const hasSuccess = existingPayinData.some(
    (item) => item.status === 'SUCCESS',
  );
  if (hasSuccess) {
    payinData = existingPayinData.filter(
      (item) => item.status === 'SUCCESS',
    )[0];
  } else {
    payinData = existingPayinData[existingPayinData.length - 1];
  }
  // Construct the error message
  let message;
  if (payinData) {
    if (payinData.status === 'SUCCESS') {
      message = `✅ UTR ${utr} is already confirmed with this orderId ${payinData.merchant_order_id}`;
    } else {
      message = `🚨 UTR ${utr} is already ${payinData.status} with this orderId ${payinData.merchant_order_id}`;
    }
  } else {
    if (getPayInData.user_submitted_utr) {
      if (getPayInData.status === 'SUCCESS') {
        message = `✅ Merchant Order ID: ${getPayInData.merchant_order_id}
                  is Already Confirmed with UTR: ${getPayInData.user_submitted_utr}`;
      } else {
        message = `🚨 Merchant Order ID: ${getPayInData.merchant_order_id}
                  is Already Marked ${getPayInData.status} with UTR: ${getPayInData.user_submitted_utr}`;
      }
    }
    else {
      const botResponse = await getBankResponseDao({
        id: getPayInData.bank_response_id,
        company_id: getPayInData.company_id,
      })
      if (getPayInData.status === 'SUCCESS') {
        message = `✅ Merchant Order ID: ${getPayInData.merchant_order_id}
                  is Already Confirmed with UTR: ${botResponse.utr}`;
      } else {
        message = `🚨 Merchant Order ID: ${getPayInData.merchant_order_id}
                  is Already Marked ${getPayInData.status} with UTR: ${botResponse.utr}`;
      }
    }
  }

  const success = await telegramSender(chatId, message, replyToMessageId, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendMerchantOrderIDStatusDuplicateTelegramMessage(
  chatId,
  getPayInData,
  utr,
  TELEGRAM_BOT_TOKEN,
  replyToMessageId,
  existingPayinData,
) {
  let payinData = {};
  const hasSuccess = existingPayinData.some(
    (item) => item.status === 'SUCCESS',
  );
  if (hasSuccess) {
    payinData = existingPayinData.filter(
      (item) => item.status === 'SUCCESS',
    )[0];
  } else {
    payinData = existingPayinData[existingPayinData.length - 1];
  }
  // Construct the error message
  let message;
  if (payinData) {
    if (payinData.status === 'SUCCESS') {
      message = `✅ UTR ${utr} is already confirmed with this orderId ${payinData.merchant_order_id}`;
    } else {
      message = `🚨 UTR ${utr} is already ${payinData.status} with this orderId ${payinData.merchant_order_id}`;
    }
  } else {
    if (getPayInData.user_submitted_utr) {
      if (getPayInData.status === 'SUCCESS') {
        message = `✅ Merchant Order ID: ${getPayInData.merchant_order_id}
                  is Already Confirmed with UTR: ${getPayInData.user_submitted_utr}`;
      } else {
        message = `🚨 Merchant Order ID: ${getPayInData.merchant_order_id}
                  is Already Marked ${getPayInData.status} with UTR: ${getPayInData.user_submitted_utr}`;
      }
    }
    else {
      const botResponse = await getBankResponseDao({
        id: getPayInData.bank_response_id,
        company_id: getPayInData.company_id,
      })
      if (getPayInData.status === 'SUCCESS') {
        message = `✅ Merchant Order ID: ${getPayInData.merchant_order_id}
                  is Already Confirmed with UTR: ${botResponse.user_submitted_utr}`;
      } else {
        message = `🚨 Merchant Order ID: ${getPayInData.merchant_order_id}
                  is Already Marked ${getPayInData.status} with UTR: ${botResponse.utr}`;
      }
    }
  }

  const success = await telegramSender(chatId, message, replyToMessageId, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}
