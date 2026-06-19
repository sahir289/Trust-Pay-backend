import { getBankResponseDao } from '../apis/bankResponse/bankResponseDao.js';
import { Status } from '../constants/index.js';
import { createTelegramSender, sendTelegramFile } from '../helpers/telegramApi.js';
import { logger } from './logger.js';
import { getCachedData, setCachedData } from './redishashkey.js';
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
  date,
  vendorboardChatId
) {
  totalBankWithdrawalAllVendors = totalBankWithdrawalAllVendors.toLocaleString(
    'en-IN',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );
  totalBankDepositAllVendors = totalBankDepositAllVendors.toLocaleString(
    'en-IN',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );
  totalpayinsMerchant = totalpayinsMerchant.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  totalpayoutsMerchant = totalpayoutsMerchant.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const currentDate = new Date().toISOString().split('T')[0];
  const now = new Date();
  const istTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
  );
  //formatting time for 30 mins report
  const currentMinutes = istTime.getMinutes();
  const currentHours = istTime.getHours();
  let startHour = currentHours;
  let startMinutes = 0;
  let endHour = currentHours;
  let endMinutes = 0;
  if (currentMinutes < 30) {
    startHour = (currentHours - 1 + 24) % 24;
    startMinutes = 30;
    endHour = currentHours;
    endMinutes = 0;
  } else {
    startHour = currentHours;
    startMinutes = 0;
    endHour = currentHours;
    endMinutes = 30;
  }
  if (currentMinutes === 0) {
    startHour = (currentHours - 1 + 24) % 24;
    startMinutes = 30;
    endHour = currentHours;
    endMinutes = 0;
  } else if (currentMinutes === 30) {
    startHour = currentHours;
    startMinutes = 0;
    endHour = currentHours;
    endMinutes = 30;
  }
  function formatTime(hour, minute) {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute}${ampm}`;
  }
  const formattedTime = `${formatTime(startHour, startMinutes)}-${formatTime(
    endHour,
    endMinutes,
  )}`;
  const timeStamp = type === 'Hourly Report' ? formattedTime  : date ? date : currentDate;

  const merchantPayInDetails = merchant
    .filter((m) => m.totalPayin !== 0)
    .map(
      (m, index) =>
        `${index + 1}. ${m.merchantId}: ₹ ${m.totalPayin.toLocaleString(
          'en-IN',
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        )} (${m.totalPayinCount}),`,
    )
    .join('\n');

  const merchantPayOutDetails = merchant
    .filter((m) => m.totalPayout !== 0)
    .map(
      (m, index) =>
        `${index + 1}. ${m.merchantId}: ₹ ${m.totalPayout.toLocaleString(
          'en-IN',
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        )} (${m.totalPayoutCount}),`,
    )
    .join('\n');

  const vendorDetails = Object.entries(vendorObjpayIn)
    .sort(([vendorCodeA], [vendorCodeB]) =>
      vendorCodeA.localeCompare(vendorCodeB),
    )
    .map(([vendorCode, { banks }], index) => {
      const filteredBanks = banks.filter(
        (bank) => bank.TotalDeposit !== null && bank.TotalDeposit !== 0,
      );
      const bankDetails = filteredBanks
        .map(
          (bank) =>
            `  ${bank.bankName}: ₹ ${bank.TotalDeposit.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} (${bank.TotalCount})`,
        )
        .join('\n');
      const totalBankDeposit = filteredBanks.reduce(
        (sum, bank) => sum + (bank.TotalDeposit || 0),
        0,
      );
      return bankDetails
        ? {
            vendorCode,
            total: totalBankDeposit,
            details: bankDetails,
            index: index + 1,
          }
        : null;
    })
    .filter(Boolean);

  const vendorDetailsPayout = Object.entries(vendorObjpayOut)
    .sort(([vendorCodeA], [vendorCodeB]) =>
      vendorCodeA.localeCompare(vendorCodeB),
    )
    .map(([vendorCode, { banks }], index) => {
      const filteredBanks = banks.filter(
        (bank) => bank.TotalDeposit !== null && bank.TotalDeposit !== 0,
      );
      const bankDetails = filteredBanks
        .map(
          (bank) =>
            `  ${bank.bankName}: ₹ ${bank.TotalDeposit.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} (${bank.TotalCount})`,
        )
        .join('\n');
      const totalBankPayout = filteredBanks.reduce(
        (sum, bank) => sum + (bank.TotalDeposit || 0),
        0,
      );
      return bankDetails
        ? {
            vendorCode,
            total: totalBankPayout,
            details: bankDetails,
            index: index + 1,
          }
        : null;
    })
    .filter(Boolean)
  const splitIntoChunks = (array) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += 3) {
      chunks.push(array.slice(i, i + 3));
    }
    return chunks;
  };
  const depositChunks = splitIntoChunks(vendorDetails);
  const withdrawalChunks = splitIntoChunks(vendorDetailsPayout);

  const message1 = `
<b>(${timeStamp}) IST</b> <b>\n</b>
<b>💰 Deposits</b>

${merchantPayInDetails}<b>\n</b>
<b>Total Deposits:</b> ₹ ${totalpayinsMerchant}<b>\n\n</b>
<b>🏦 Withdrawals</b>

${merchantPayOutDetails}<b>\n</b>
<b>Total Withdrawals:</b> ₹ ${totalpayoutsMerchant}<b>\n</b>`;
  const success1 = await telegramSender(
    chatId,
    message1,
    null,
    TELEGRAM_BOT_TOKEN,
  );
  logger.log(success1 ? 'Sent message1!' : 'Not sent: message1.');
  const success2 = [];
  if (depositChunks.length === 0) {
    const message2 = `
<b>(${timeStamp}) IST</b>\n
<b>✅ Bank Account Deposits</b>\n
No bank account deposits recorded.\n
<b>Total Bank Account Deposits:</b> ₹ ${totalBankDepositAllVendors}
`;
    const sent = await telegramSender(vendorboardChatId, message2, null, TELEGRAM_BOT_TOKEN);
    success2.push(sent);
    logger.log(sent ? 'Sent message2 (No deposits)!' : 'Not sent: message2 (No deposits).');
  }
  for (let i = 0; i < depositChunks.length; i++) {
    const chunk = depositChunks[i];
    const partMessage = chunk
      .map(
        (item) =>
          `${item.index}. ${item.vendorCode}: ₹ ${item.total.toLocaleString(
            'en-IN',
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            },
          )}\n${item.details}`,
      )
      .join('\n\n');
    const message2 = `
${i === 0 ? `<b>(${timeStamp}) IST</b>\n\n<b>✅ Bank Account Deposits</b>` : ''}

${partMessage}

${i === depositChunks.length - 1 ? `<b>Total Bank Account Deposits:</b> ₹ ${totalBankDepositAllVendors}` : ''}
`;
    const sent = await telegramSender(
      vendorboardChatId,
      message2,
      null,
      TELEGRAM_BOT_TOKEN,
    );
    success2.push(sent);
    logger.log(
      sent
        ? `Sent message2 (Part ${i + 1})!`
        : `Not sent: message2 (Part ${i + 1}).`,
    );
  }
  const success3 = [];
  if (withdrawalChunks.length === 0) {
    const message3 = `
<b>(${timeStamp}) IST</b>\n
<b>✅ Bank Account Withdrawals</b>\n
No bank account withdrawals recorded.\n
<b>Total Bank Account Withdrawals:</b> ₹ ${totalBankWithdrawalAllVendors}
`;
const sent = await telegramSender(
      vendorboardChatId,
      message3,
      null,
      TELEGRAM_BOT_TOKEN,
    );
    success3.push(sent);
    logger.log(
      sent
        ? 'Sent message3 (No withdrawals)!'
        : 'Not sent: message3 (No withdrawals).',
    );
  }
  for (let i = 0; i < withdrawalChunks.length; i++) {
    const chunk = withdrawalChunks[i];
    const partMessage = chunk
      .map(
        (item) =>
          `${item.index}. ${item.vendorCode}: ₹ ${item.total.toLocaleString(
            'en-IN',
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            },
          )}\n${item.details}`,
      )
      .join('\n\n');
    const message3 = `
${i === 0 ? `<b>(${timeStamp}) IST</b>\n\n<b>✅ Bank Account Withdrawals</b>` : ''}

${partMessage}

${i === withdrawalChunks.length - 1 ? `<b>Total Bank Account Withdrawals:</b> ₹ ${totalBankWithdrawalAllVendors}` : ''}
`;
    const sent = await telegramSender(
      vendorboardChatId,
      message3,
      null,
      TELEGRAM_BOT_TOKEN,
    );
    success3.push(sent);
    logger.log(
      sent
        ? `Sent message3 (Part ${i + 1})!`
        : `Not sent: message3 (Part ${i + 1}).`,
    );
  }
  return {success1, success2, success3 };
}

export async function sendTelegramMerchantDashboardReportMessage(
  chatId,
  merchantBalanceData,
  TELEGRAM_BOT_TOKEN,
) {
  try {
    const BATCH_SIZE = 20; // Number of merchants per message
    const DELAY_MS = 1000; // Delay between messages

    // Sort merchants alphabetically by code (handle null/undefined codes)
    const sortedMerchants = merchantBalanceData.sort((a, b) => {
      const codeA = a.code || '';
      const codeB = b.code || '';
      return codeA.localeCompare(codeB);
    });

    // Split merchants into batches
    const batches = [];
    for (let i = 0; i < sortedMerchants.length; i += BATCH_SIZE) {
      batches.push(sortedMerchants.slice(i, i + BATCH_SIZE));
    }

    let allSuccess = true;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const merchantDetails = batch
        .map(
          (merchant) =>
            `<b>${merchant.code}:</b> <b>Net Balance:</b> ₹ ${merchant.net_balance.toLocaleString(
              'en-IN',
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            )}`,
        )
        .join('\n');

      const messageHeader = `<b>Merchant Dashboard Report</b> (${i + 1}/${batches.length})`;

      const message = `${messageHeader}

${merchantDetails}`;

      const success = await telegramSender(
        chatId,
        message,
        null,
        TELEGRAM_BOT_TOKEN,
      );

      logger.log(
        `Batch ${i + 1}/${batches.length}: ${success ? 'Sent!' : 'Not sent.'}`,
      );

      if (!success) {
        allSuccess = false;
      }

      // Add delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    return allSuccess;
  } catch (error) {
    logger.error('Error in sendTelegramMerchantDashboardReportMessage:', error.message);
    return false;
  }
}

export async function sendTelegramVendorDashboardReportMessage(
  chatId,
  vendorBalanceData,
  TELEGRAM_BOT_TOKEN,
) {
  try {
    const BATCH_SIZE = 20; // Number of vendors per message
    const DELAY_MS = 1000; // Delay between messages

    // Sort vendors alphabetically by code (handle null/undefined codes)
    const sortedVendors = vendorBalanceData.sort((a, b) => {
      const codeA = a.code || '';
      const codeB = b.code || '';
      return codeA.localeCompare(codeB);
    });

    // Split vendors into batches
    const batches = [];
    for (let i = 0; i < sortedVendors.length; i += BATCH_SIZE) {
      batches.push(sortedVendors.slice(i, i + BATCH_SIZE));
    }

    let allSuccess = true;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const vendorDetails = batch
        .map(
          (vendor) =>
            `<b>${vendor.code}:</b> <b>Net Balance:</b> ₹ ${vendor.net_balance.toLocaleString(
              'en-IN',
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            )}`,
        )
        .join('\n');

      const messageHeader = `<b>Vendor Dashboard Report</b> (${i + 1}/${batches.length})`;

      const message = `${messageHeader}

${vendorDetails}`;

      const success = await telegramSender(
        chatId,
        message,
        null,
        TELEGRAM_BOT_TOKEN,
      );

      logger.log(
        `Batch ${i + 1}/${batches.length}: ${success ? 'Sent!' : 'Not sent.'}`,
      );

      if (!success) {
        allSuccess = false;
      }

      // Add delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    return allSuccess;
  } catch (error) {
    logger.error('Error in sendTelegramVendorDashboardReportMessage:', error.message);
    return false;
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
  TELEGRAM_BOT_TOKEN,
  type,
) {
  totalPayinsMerchant = totalPayinsMerchant.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  merchantTotalPayout = merchantTotalPayout.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  totalPayInSum = totalPayInSum.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  totalPayOutSum = totalPayOutSum.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const currentDate = new Date().toISOString().split('T')[0];
  const now = new Date();
  const istTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
  );

  let startHour = istTime.getHours() - 1;
  let endHour = (startHour + 1) % 24;

  const startAmpm = startHour >= 12 ? 'PM' : 'AM';
  const endAmpm = endHour >= 12 ? 'PM' : 'AM';

  // Convert hours to 12-hour format
  startHour = startHour % 12 || 12;
  endHour = endHour % 12 || 12;
  const formattedTime = `${startHour}${startAmpm}-${endHour}${endAmpm}`;
  const timeStamp = type === 'Hourly Report' ? formattedTime : currentDate;
  //   const merchantAllPayinDetails = totalPayinsMerchant.map(m =>
  //     `<b>Merchant:</b> ${m.merchantId} | <b>PayIn:</b> ${m.totalPayIn} | <b>Count:</b> ${m.totalPayInEachCount}`
  // ).join("\n");
  const merchantAllPayinDetails = (
    Array.isArray(totalPayinsMerchant) ? totalPayinsMerchant : []
  )
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

  const success = await telegramSender(
    chatId,
    message,
    null,
    TELEGRAM_BOT_TOKEN,
  );
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendTelegramDashboardSuccessRatioMessage(
  chatId,
  fullMessages,
  TELEGRAM_BOT_TOKEN,
) {
  try {
    // Debug log
    logger.info(
      `Sending messages to Telegram. Total messages: ${fullMessages.length}`,
    );

    const BATCH_SIZE = 5;
    const DELAY_MS = 2000;

    // Group messages by first letter of merchant code
    const groupedMessages = fullMessages.reduce((groups, message) => {
      const firstLetter = message.merchantCode[0].toUpperCase();
      if (!groups[firstLetter]) groups[firstLetter] = [];
      groups[firstLetter].push(message);
      return groups;
    }, {});

    // Sort groups by letter and merchants within groups
    for (const letter of Object.keys(groupedMessages).sort()) {
      const batch = groupedMessages[letter];

      // Sort merchants within each group
      batch.sort((a, b) => a.merchantCode.localeCompare(b.merchantCode));

      // Send messages in smaller batches
      for (let i = 0; i < batch.length; i += BATCH_SIZE) {
        const currentBatch = batch.slice(i, i + BATCH_SIZE);

        await Promise.all(
          currentBatch.map(
            async ({ merchantCode, intervalDetails, intervalDetailsUtr }) => {
              const message = `🔔 <b>${merchantCode}</b> - SR 🔔\n\n<b>PayIn SR:</b>\n${intervalDetails}\n\n<b>UTR SR:</b>\n${intervalDetailsUtr}`;

              try {
                const success = await telegramSender(
                  chatId,
                  message,
                  null,
                  TELEGRAM_BOT_TOKEN,
                );

                logger.info(
                  `Message sent for ${merchantCode}: ${success ? 'Success' : 'Failed'}`,
                );
                return success;
              } catch (error) {
                logger.error(
                  `Failed to send message for ${merchantCode}:`,
                  error.message,
                );
                return false;
              }
            },
          ),
        );

        // Add delay between batches
        if (i + BATCH_SIZE < batch.length) {
          await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        }
      }

      // Add delay between groups
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }

    logger.info('Finished sending all messages to Telegram');
  } catch (error) {
    logger.error('Error in sendTelegramDashboardSuccessRatioMessage:', error.message);
    throw error;
  }
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
  const success = await telegramSender(
    chatId,
    message,
    replyToMessageId,
    TELEGRAM_BOT_TOKEN,
  );
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

  const success = await telegramSender(
    chatId,
    message,
    replyToMessageId,
    TELEGRAM_BOT_TOKEN,
  );
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

  const success = await telegramSender(
    chatId,
    message,
    replyToMessageId,
    TELEGRAM_BOT_TOKEN,
  );
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

  const success = await telegramSender(
    chatId,
    message,
    replyToMessageId,
    TELEGRAM_BOT_TOKEN,
  );
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}
export const sendPaymentStatusMessageTelegramBot = async (
  chatId,
  merchantOrderIdTele,
  TELEGRAM_BOT_TOKEN,
  replyToMessageId,
  Status,
) => {
  const message = `⛔ Payment for Merchant Order ID ${merchantOrderIdTele} has already ${Status}.`;
  const success = await telegramSender(
    chatId,
    message,
    replyToMessageId,
    TELEGRAM_BOT_TOKEN,
  );
  return success;
};
export async function sendUTRMismatchErrorMessageTelegram(
  chatId,
  utr,
  userSubmittedUtr,
  TELEGRAM_BOT_TOKEN,
  replyToMessageId,
) {
  // Construct the error message
  const message = `⛔ UTR - ${utr} does not match with the UTR submitted by the user - ${userSubmittedUtr}`;

  const success = await telegramSender(
    chatId,
    message,
    replyToMessageId,
    TELEGRAM_BOT_TOKEN,
  );
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

  const success = await telegramSender(
    chatId,
    message,
    replyToMessageId,
    TELEGRAM_BOT_TOKEN,
  );
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

  const success = await telegramSender(
    chatId,
    message,
    replyToMessageId,
    TELEGRAM_BOT_TOKEN,
  );
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

  const success = await telegramSender(
    chatId,
    message,
    replyToMessageId,
    TELEGRAM_BOT_TOKEN,
  );
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

  const success = await telegramSender(
    chatId,
    message,
    replyToMessageId,
    TELEGRAM_BOT_TOKEN,
  );
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

  const success = await telegramSender(
    chatId,
    message,
    replyToMessageId,
    TELEGRAM_BOT_TOKEN,
  );
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
    } else {
      const botResponse = await getBankResponseDao({
        id: getPayInData.bank_response_id,
        company_id: getPayInData.company_id,
      });
      if (getPayInData.status === 'SUCCESS') {
        message = `✅ Merchant Order ID: ${getPayInData.merchant_order_id}
                  is Already Confirmed with UTR: ${botResponse.utr}`;
      } else {
        message = `🚨 Merchant Order ID: ${getPayInData.merchant_order_id}
                  is Already Marked ${getPayInData.status} with UTR: ${botResponse.utr}`;
      }
    }
  }

  const success = await telegramSender(
    chatId,
    message,
    replyToMessageId,
    TELEGRAM_BOT_TOKEN,
  );
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
    } else {
      const botResponse = await getBankResponseDao({
        id: getPayInData.bank_response_id,
        company_id: getPayInData.company_id,
      });
      if (getPayInData.status === 'SUCCESS') {
        message = `✅ Merchant Order ID: ${getPayInData.merchant_order_id}
                  is Already Confirmed with UTR: ${botResponse.user_submitted_utr}`;
      } else {
        message = `🚨 Merchant Order ID: ${getPayInData.merchant_order_id}
                  is Already Marked ${getPayInData.status} with UTR: ${botResponse.utr}`;
      }
    }
  }

  const success = await telegramSender(
    chatId,
    message,
    replyToMessageId,
    TELEGRAM_BOT_TOKEN,
  );
  logger.log(success ? 'Sent!' : 'Not sent.');
  return success;
}

export async function sendBankNotAssignedAlertTelegram(
  chatId,
  code,
  TELEGRAM_BOT_TOKEN,
) {
  // Construct the alert message
  const message = `<b>⛔ Bank not Assigned with :</b> ${code}`;

  try {
    const KEY_PREFIX = 'bank_alert';
    const cacheKey = `${KEY_PREFIX}:${code}`;
    const HOLD_TIME = 60; 
    const cooldownActive = await getCachedData(cacheKey);
    if (cooldownActive) {
      logger.log(
        `Duplicate alert suppressed for code: ${code} (bank_alert active for ${HOLD_TIME}s)`,
      );
      return; 
    }
    const success = await telegramSender(
      chatId,
      message,
      null,
      TELEGRAM_BOT_TOKEN,
    );
    if (success) {
      logger.log('Sent!');
      await setCachedData(cacheKey, '1', HOLD_TIME);
    } else {
      logger.log('Not sent.');
    }
  } catch (error) {
    logger.error('Error sending bank not assigned alert to Telegram:', error.message);
  }
}

export async function sendTelegramDisputeMessage(
  chatId,
  oldData,
  currentData,
  newData,
  nick_name,
  utr,
  TELEGRAM_BOT_TOKEN,
) {
  const formatEntry = (label, data, utr) => `
    <b><u>${label}:</u></b> 
        <b>📋 Status:</b> ${data.status === Status.SUCCESS ? '✅ SUCCESS' : data.status === Status.DISPUTE ? '⛔ DISPUTE' : data.status === Status.FAILED ? '❌ FAILED' : data.status}
        <b>🧾 UTR:</b> ${utr}
        <b>✅ Amount:</b> ${data.amount}
        <b>💳 UPI Short Code:</b> ${data.upi_short_code}
        <b>🏦 Bank Name:</b> ${nick_name}
        <b>Merchant Order Id:</b> ${data.merchant_order_id}
        <b>PayIn Id:</b> ${data.id}
        <b>Merchant Id:</b> ${data.merchant_id}
        <b>User Id:</b> ${data.user}
  `;

  let message = formatEntry('Dispute Entry', oldData, utr);

  if (
    newData &&
    typeof newData === 'object' &&
    newData.merchant_order_id !== undefined &&
    currentData?.merchant_order_id !== newData.merchant_order_id
  ) {
    message += formatEntry('Current Entry', currentData, utr);
    message += formatEntry('New Entry', newData, utr);
  } else {
    message += formatEntry('New Entry', currentData, utr);
  }
  const success = await telegramSender(
    chatId,
    message,
    null,
    TELEGRAM_BOT_TOKEN,
  );
  logger.log(success ? 'Sent!' : 'Not sent.');
}

export async function sendTelegramStatementNotUploadedMessage(
  chatId,
  nick_name,
  vendor_code,
  TELEGRAM_BOT_TOKEN,
) {

  let message = `<b>⛔ Statement Not Uploaded for Vendor Code:</b> ${vendor_code} <b>for Bank Name:</b> ${nick_name}`;
  const success = await telegramSender(
    chatId,
    message,
    null,
    TELEGRAM_BOT_TOKEN,
  );
  logger.log(success ? 'Sent!' : 'Not sent.');
}

/**
 * Send pending statement upload CSV report to Telegram admins
 * @param {string} chatId - Telegram chat ID
 * @param {Buffer} csvBuffer - CSV file buffer
 * @param {string} fileName - File name with .csv extension
 * @param {string} caption - Caption for the file
 * @param {string} token - Telegram bot token (optional)
 * @returns {Promise<boolean>} - True if sent successfully
 */
export async function sendTelegramStatementUploadCSV(
  chatId,
  csvBuffer,
  fileName,
  caption,
  token,
) {
  try {
    const success = await sendTelegramFile(
      chatId,
      csvBuffer,
      fileName,
      caption,
      token,
    );

    logger.log(
      success
        ? `CSV file ${fileName} sent to chat ${chatId}!`
        : `Failed to send CSV file ${fileName} to chat ${chatId}.`,
    );

    return success;
  } catch (error) {
    logger.error(
      `Error in sendTelegramStatementUploadCSV: ${error.message}`,
      error,
    );
    return false;
  }
}
