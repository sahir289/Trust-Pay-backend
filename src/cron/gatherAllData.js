import cron from 'node-cron';
import { getMerchantsDao } from '../apis/merchants/merchantDao.js';
import { getPayInUrlsDao } from '../apis/payIn/payInDao.js';
import { getCalculationDao } from '../apis/calculation/calculationDao.js';
// import { getPayoutsCronDao } from '../apis/payOut/payOutDao.js';
import moment from 'moment-timezone';
import { getBankaccountDao } from '../apis/bankAccounts/bankaccountDao.js';
import {
  // sendTelegramDashboardMerchantGroupingReportMessage,
  sendTelegramDashboardReportMessage,
  sendTelegramDashboardSuccessRatioMessage,
} from '../utils/sendTelegramMessages.js';
import config from '../config/config.js';
import { getConnection } from '../utils/db.js';
import { getVendorsDao } from '../apis/vendors/vendorDao.js';
import { logger } from '../utils/logger.js';

cron.schedule('0 0 * * *', () => {
  gatherAllData('Asia/Kolkata');
});

cron.schedule('0 1-23 * * *', () => {
  gatherAllData('H', 'Asia/Kolkata');
});

const gatherAllData = async (type = 'N', timezone = 'Asia/Kolkata') => {
  let conn;
  try {
    conn = await getConnection();

    let sDate;
    let eDate;
    if (typeof timezone !== 'string') {
      timezone = 'Asia/Kolkata';
    }

    const currentDate = moment().tz(timezone, true);

if (type === 'H') {
  sDate = currentDate.clone().startOf('day').toDate();
  eDate = currentDate.clone().toDate();
} else if (type === 'N') {
  sDate = currentDate.clone().subtract(1, 'day').startOf('day').toDate();
  eDate = currentDate.clone().subtract(1, 'day').endOf('day').toDate();
} else {
  sDate = currentDate.clone().subtract(1, 'day').toDate();
  eDate = currentDate.clone().toDate();
}
    logger.info('cron_started');
    const merchants = await getMerchantsDao({});
    let merchant = [];
    let totalpayinsMerchant = 0;
    let totalpayoutsMerchant = 0;

    for (const merch of merchants) {
      const calculationData = await getCalculationDao({ user_id: merch.user_id, sDate, eDate  });
      merchant.push({
        merchantId: merch.code,
        totalPayin: calculationData.total_payin_amount || 0,
        totalPayinCount: calculationData.total_payin_count || 0,
        totalPayout: calculationData.total_payout_amount || 0,
        totalPayoutCount: calculationData.total_payout_countv || 0,
      });
      totalpayinsMerchant = totalpayinsMerchant + calculationData.total_payin_amount
      totalpayoutsMerchant = totalpayoutsMerchant + calculationData.total_payout_amount
    }

    const vendorData = await getVendorsDao({}, null, null, "created_at", "DESC")
    let vendorObjpayIn = {}
    let vendorArray = []
    let vendorObjpayOut = []
    let totalBankDepositAllVendors = 0;
    let totalBankWithdrawalAllVendors = 0;
    for (const vendorDetail of vendorData) {
      const banksData = await getBankaccountDao(
        { user_id: vendorDetail.user_id, bank_used_for: 'PayIn' },
        null,
        null,
        'ADMIN'
      );
      let totalBankDeposit = 0;
      const banks = banksData.map(bankData => {
        return {
          bankName: bankData.nick_name,
          TotalDeposit: bankData.balance,
          TotalCount: bankData.payin_count
        };
      });
      totalBankDepositAllVendors += totalBankDeposit;
      const vendorEntry = { banks };
      vendorObjpayIn[vendorDetail.code] = vendorEntry;
      vendorArray.push(vendorEntry);
    }
    for (const vendorDetail of vendorData) {
      const banksData = await getBankaccountDao(
        { user_id: vendorDetail.user_id, bank_used_for: 'PayOut' },
        null,
        null,
        'ADMIN'
      );
      let totalBankDepositPayout = 0
      const banks = banksData.map(bankData => {
        return {
          bankName: bankData.nick_name,
          TotalDeposit: bankData.balance,
          TotalCount: bankData.payin_count
        };
      });
      totalBankWithdrawalAllVendors += totalBankDepositPayout;
      const vendorEntry = { banks };
      vendorObjpayOut[vendorDetail.code] = vendorEntry;
      vendorArray.push(vendorEntry);
    }

    // let settlements = await getSettlementDao({});
    // let settlementdata = [];
    // if (settlements) {
    //   for (let settlement of settlements) {
    //     settlementdata.push({
    //       settlementdataId: settlement.id,
    //       settlementdataBalance: settlement.amount,
    //     });
    //   }
    // } else {
    //   console.log('no settlement banks data');
    // }
    // let chargebacks = await getChargeBackDao({}, null, null);
    // let chargebackData = [];
    // if (chargebacks) {
    //   for (let chargeback of chargebacks) {
    //     chargebackData.push({
    //       chargebackDataID: chargeback.id,
    //       chargebackDataBalance: chargeback.amount,
    //       chargebackDataToday: chargeback.when,
    //       chargeBank: chargeback.bank_acc_id,
    //     });
    //   }
    // } else {
    //   console.log('no chargeback banks data');
    // }


    const formattedSuccessRatiosByMerchant = async () => {
      try {
        const now = new Date();
        const intervals = [
          { label: 'Last 5m', duration: 5 * 60 * 1000 },
          { label: 'Last 15m', duration: 15 * 60 * 1000 },
          { label: 'Last 30m', duration: 30 * 60 * 1000 },
          { label: 'Last 1h', duration: 60 * 60 * 1000 },
          { label: 'Last 3h', duration: 3 * 60 * 60 * 1000 },
          { label: 'Last 24h', duration: 24 * 60 * 60 * 1000 },
        ];

        // fetch all transactions
        const allPayins = await getPayInUrlsDao({});
        // group transactions by merchant_id
        const transactionsByMerchant = allPayins.reduce((map, payin) => {
          if (!map[payin.merchant_id]) map[payin.merchant_id] = [];
          map[payin.merchant_id].push({
            updated_at: new Date(payin.updated_at),
            status: payin.status,
            user_submitted_utr: payin.user_submitted_utr,
          });
          return map;
        }, {});

        const merchantsWithTransactions = merchants.filter(
          (merchant) =>
            Array.isArray(transactionsByMerchant[merchant.id]) &&
            transactionsByMerchant[merchant.id].length > 0,
        );

        // Check transactions for each merchant
        merchants.forEach((merchant) => {
          const transactions = transactionsByMerchant[merchant.id];
          if (!transactions) {
            console.log(merchant.id, 'has no transactions available.');
          } else {
            console.log('transactions for merchant');
          }
        });

        const fullMessages = [];
        for (const merchant of merchantsWithTransactions) {
          const merchantTransactions = transactionsByMerchant[merchant.id];

          const intervalDetails = intervals
            .map(({ label, duration }) => {
              const startTime = new Date(now - duration);

              const filteredTransactions = merchantTransactions.filter(
                (tx) => tx.updatedAt >= startTime,
              );

              const total = filteredTransactions.length;
              const success = filteredTransactions.filter(
                (tx) => tx.status === 'SUCCESS',
              ).length;

              const successRatio =
                total === 0
                  ? '0.00%'
                  : Math.min(((success / total) * 100).toFixed(2), 100) + '%';
              const statusIcon = success === 0 ? '⚠️' : '✅';

              return `${statusIcon} ${label}: ${success}/${total} = ${successRatio}`;
            })
            .join('\n');

          const intervalDetailsUtr = intervals
            .map(({ label, duration }) => {
              const startTime = new Date(now - duration);

              const filteredTransactions = merchantTransactions.filter(
                (tx) => tx.updatedAt >= startTime,
              );

              const total = filteredTransactions.length;

              const utrSubmission = filteredTransactions.filter(
                (tx) =>
                  tx.user_submitted_utr && tx.user_submitted_utr.length > 0,
              ).length;

              const statusIcon = utrSubmission === 0 ? '⚠️' : '✅';

              const utrSubmissionRatio =
                total === 0
                  ? '0.00%'
                  : Math.min(((utrSubmission / total) * 100).toFixed(2), 100) +
                    '%';

              return `${statusIcon} ${label}: ${utrSubmission}/${total} = ${utrSubmissionRatio}`;
            })
            .join('\n');

          const fullMessage = {
            merchantCode: merchant.code,
            intervalDetails,
            intervalDetailsUtr,
          };
          fullMessages.push(fullMessage);
        }
        await sendTelegramDashboardSuccessRatioMessage(
          config?.telegramRatioAlertsChatId,
          fullMessages,
          config?.telegramBotToken,
        );

        await sendTelegramDashboardReportMessage(
          config?.telegramDashboardChatId,
          merchant,
          totalpayinsMerchant,
          totalpayoutsMerchant,
          vendorObjpayIn,
          vendorObjpayOut,
          totalBankDepositAllVendors,
          totalBankWithdrawalAllVendors,
          config?.telegramBotToken,
          type === 'H' ? 'Hourly Report' : 'Daily Report',
        );

        // await sendTelegramDashboardMerchantGroupingReportMessage(
        //   config?.telegramDashboardMerchantGroupingChatId,
        //   formatePrice(totalPayInSum),
        //   formatePrice(totalPayOutSum),
        //   formatePrice(totalPayInCount),
        //   formatePrice(totalPayOutCount),
        //   type === 'H' ? 'Hourly Report' : 'Daily Report',
        //   // totalPayInSum,
        //   // totalPayOutSum,
        //   // totalPayInCount,
        //   // totalPayOutCount,

        //   totalPayinsMerchant,
        //   merchantTotalPayout,

        //   config?.telegramBotToken,
        // );
      } catch (error) {
        console.error('Error ', error.message);
      }
    };
    formattedSuccessRatiosByMerchant();
  } catch (error) {
    console.error(error);
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

export default gatherAllData;
