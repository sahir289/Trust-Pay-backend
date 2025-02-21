import axios from "axios";
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
  // TELEGRAM_BOT_TOKEN,
) {
  const currentDate = new Date().toISOString().split("T")[0];
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


  const merchantPayInDetails = (merchant || []).map(m =>
    `<b>Merchant:</b> ${m.merchantId} | <b>PayIn:</b> ${m.payInSum} | <b>Count:</b> ${m.payInCount}`
  ).join("\n");
  const merchantPayOutDetails = (merchantpayout || []).map(m =>
    `<b>Merchant:</b> ${m.merchantId} | <b>PayOut:</b> ${m.payOut} | <b>Count:</b> ${m.payInEachCount}`
  ).join("\n");
  const bankPayInDetails = (payInBanksdata || []).map(m =>
    `<b>Bank:</b> ${m.bankID} | <b>BankPayOut:</b> ${m.payInBalance} | <b>Count:</b> ${m.payInToday}`
  ).join("\n");
  
  
  const bankPayOutDetails = (payOutBanksdata || []).map(m =>
    `<b>Bank:</b> ${m.payoutbankId} | <b>BankPayIn:</b> ${m.payoutbankBalance} | <b>Count:</b> ${m.payoutbankToday}`
  ).join("\n");

  const settlementInDetails = (settlementdata || []).map(m =>
    `<b>Settlement:</b> ${m.settlementdataId} | <b>Balance:</b> ${m.settlementdataBalance} `
  ).join("\n");

  const chargebackDetails = (chargebackData || []).map(m =>
    `<b>Chargeback:</b> ${m.chargebackDataID} | <b>Balance:</b> ${m.chargebackDataBalance} | <b>Today Balance:</b> ${m.chargebackDataToday}| <b>Bank :</b> ${m.chargeBank} `
  ).join("\n");

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
  
  <b>✅ Chargeback </b>
    <b>✅ Chargeback</b>${chargebackDetails}

  <b>Total Chargeback </b> ${chargebacks}`;

  // const sendMessageUrl = ""
  // `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    console.log(message, "message12telegram")
    // const response = await axios.post(sendMessageUrl, {
    //   chat_id: chatId,
    //   text: message,
    //   parse_mode: "HTML",
    // });

  } catch (error) {
    console.error(
      "Error sending Telegram message:",
      error.response?.data || error.message
    );
  }
}

export async function sendTelegramDashboardMerchantGroupingReportMessage(
  chatId,
  totalPayInSum,
  totalPayOutSum,
  totalPayInCount,
  totalPayOutCount,
  totalPayinsMerchant,
  merchantTotalPayout,
  // type,
) {
  const currentDate = new Date().toISOString().split("T")[0];
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
  const merchantAllPayinDetails = (totalPayinsMerchant || []).map(m =>
    `<b>Merchant:</b> ${m.merchantId} | <b>PayIn:</b> ${m.totalPayIn} | <b>Count:</b> ${m.totalPayInEachCount}`
  ).join("\n");
  const merchantAllPayOutDetails = (merchantTotalPayout || []).map(m =>
    `<b>Merchant:</b> ${m.merchantId} | <b>PayOut:</b> ${m.totalPayOutSum} | <b>Count:</b> ${m.totalPayOutCount}`
  ).join("\n");


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

  // Send the message to Telegram
  const sendMessageUrl = ""
  // `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    console.log(message, "message123telegram")

   await axios.post(sendMessageUrl, {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error(
      "Error sending Telegram message:",
      error.response?.data || error.message
    );
  }
}

export async function sendTelegramDashboardSuccessRatioMessage(
  chatId,
  // merchantCode,
  fullMessage,
  // TELEGRAM_BOT_TOKEN
) {
  const message = fullMessage
    .map(({ merchantCode, intervalDetails, intervalDetailsUtr }) => {
      return `🔔<b>${merchantCode}</b> - SR 🔔\n\n<b>Payin SR:</b>\n${intervalDetails}\n\n<b>UTR SR:</b>\n${intervalDetailsUtr}`;
    })
    .join('\n\n');

  const sendMessageUrl = ""
  // `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    console.log(message, "message14telegram")

    await axios.post(sendMessageUrl, {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error(`Error sending Telegram success ratio alerts`, error);
  }
}