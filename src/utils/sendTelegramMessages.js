import { createTelegramSender } from '../helpers/telegramApi.js';
import { logger } from './logger.js';

const telegramSender = createTelegramSender();

export async function sendTelegramDashboardReportMessage(
  chatId,
  merchant,
  merchantpayout,
  settlementdata,
  chargebackData,
  payInBanksdata,
  payOutBanksdata,
  totalPayInSum,
  totalPayOutSum,
  settlements,
  chargebacks,
  // type,
  TELEGRAM_BOT_TOKEN,
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

  // const formattedTime = `${startHour}${startAmpm}-${endHour}${endAmpm}`;
  const timeStamp =
    //  type === "Hourly Report" ? formattedTime :
    currentDate;

  const merchantPayInDetails = (merchant || [])
    .map(
      (m) =>
        `<b>Merchant:</b> ${m.merchantId} | <b>PayIn:</b> ${m.payInSum} | <b>Count:</b> ${m.payInCount}`,
    )
    .join('\n');
  const merchantPayOutDetails = (merchantpayout || [])
    .map(
      (m) =>
        `<b>Merchant:</b> ${m.merchantId} | <b>PayOut:</b> ${m.payOut} | <b>Count:</b> ${m.payInEachCount}`,
    )
    .join('\n');
  const bankPayInDetails = (payInBanksdata || [])
    .map(
      (m) =>
        `<b>Bank:</b> ${m.bankID} | <b>BankPayOut:</b> ${m.payInBalance} | <b>Count:</b> ${m.payInToday}`,
    )
    .join('\n');

  const bankPayOutDetails = (payOutBanksdata || [])
    .map(
      (m) =>
        `<b>Bank:</b> ${m.payoutbankId} | <b>BankPayIn:</b> ${m.payoutbankBalance} | <b>Count:</b> ${m.payoutbankToday}`,
    )
    .join('\n');

  const settlementInDetails = (settlementdata || [])
    .map(
      (m) =>
        `<b>Settlement:</b> ${m.settlementdataId} | <b>Balance:</b> ${m.settlementdataBalance} `,
    )
    .join('\n');

  const chargebackDetails = (chargebackData || [])
    .map(
      (m) =>
        `<b>ChargeBack:</b> ${m.chargebackDataID} | <b>Balance:</b> ${m.chargebackDataBalance} | <b>Today Balance:</b> ${m.chargebackDataToday}| <b>Bank :</b> ${m.chargeBank} `,
    )
    .join('\n');

  const message = `
  <b>

  (${timeStamp}) IST</b>
  
  <b>💰 Deposits</b>

  <b>✅ Sub-Merchant-wise PayIn Details</b>${merchantPayInDetails}

  <b>Total Deposits:</b> ${totalPayInSum}
  
  <b>🏦 Withdrawals</b>

  <b>✅ Sub-Merchant-wise PayOut Details</b>${merchantPayOutDetails}

  <b>Total Withdrawals:</b> ${totalPayOutSum}
  
  <b>✅ Bank Account Deposits</b>

  <b>✅ Bank PayIn Details</b>
  ${bankPayInDetails}
  

  
  <b>✅ Bank PayOut Account Withdrawals</b>${bankPayOutDetails}
  
 
  
  <b>✅ Settlement</b>
  <b>✅ Settlement</b>${settlementInDetails}

  <b>Total Settlement </b> ${settlements}
  
  <b>✅ ChargeBack </b>
    <b>✅ ChargeBack</b>${chargebackDetails}

  <b>Total ChargeBack </b> ${chargebacks}`;

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
    if (getPayInData.status === 'SUCCESS') {
      message = `🚨 Merchant Order ID: ${getPayInData.merchant_order_id}
                is Already Confirmed with UTR: ${getPayInData.user_submitted_utr}`;
    } else {
      message = `🚨 Merchant Order ID: ${getPayInData.merchant_order_id}
                is Already Marked ${getPayInData.status} with UTR: ${getPayInData.user_submitted_utr}`;
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
    if (getPayInData.status === 'SUCCESS') {
      message = `✅ Merchant Order ID: ${getPayInData.merchant_order_id}
                is Already Confirmed with UTR: ${getPayInData.user_submitted_utr}`;
    } else {
      message = `🚨 Merchant Order ID: ${getPayInData.merchant_order_id}
                is Already Marked ${getPayInData.status} with UTR: ${getPayInData.user_submitted_utr}`;
    }
  }

  const success = await telegramSender(chatId, message, replyToMessageId, TELEGRAM_BOT_TOKEN);
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}
