import cron from 'node-cron';
import { getMerchantsDao } from '../apis/merchants/merchantDao.js';
import { getPayInUrlsDao } from '../apis/payIn/payInDao.js';
import { getCalculationDao } from '../apis/calculation/calculationDao.js';
// import { getPayoutsCronDao } from '../apis/payOut/payOutDao.js';
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
import { getUserHierarchysDao } from '../apis/userHierarchy/userHierarchyDao.js';
import dayjs from 'dayjs';


//run only on server - side /production level
if (process.env.NODE_ENV === 'production') {
  cron.schedule('0 0 * * *', () => {
    gatherAllData('N','Asia/Kolkata');
  });

  cron.schedule('0 1-23 * * *', () => {
    gatherAllData('H', 'Asia/Kolkata');
  });
} else {
  logger.error('Cron jobs are disabled in non-production environments.');
}

const gatherAllData = async (type = 'N', timezone = 'Asia/Kolkata') => {
  let conn;
  try {
    conn = await getConnection();

    let sDate;
    let eDate;
    if (typeof timezone !== 'string') {
      timezone = 'Asia/Kolkata';
    }

    const currentDate = dayjs().tz(timezone); 
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
    const merchants = await getMerchantsDao({}, null,null);
    let merchant = [];
    let totalpayinsMerchant = 0;
    let totalpayoutsMerchant = 0;
    const allHierarchies = await getUserHierarchysDao({});
    const subMerchantIds = new Set();
    allHierarchies.forEach((hierarchy) => {
      const subMerchants = hierarchy?.config?.siblings?.sub_merchants || [];
      subMerchants.forEach((subMerchantId) =>
        subMerchantIds.add(subMerchantId),
      );
    });
    for (const merch of merchants) {
      const calculationData = await getCalculationDao({
        user_id: merch.user_id,
        sDate,
        eDate,
      });
      let totalPayinAmount = 0;
      let totalPayinCount = 0;
      let totalPayoutAmount = 0;
      let totalPayoutCount = 0;

      for (const data of calculationData) {
        totalPayinAmount += data.total_payin_amount || 0;
        totalPayinCount += data.total_payin_count || 0;
        totalPayoutAmount += data.total_payout_amount || 0;
        totalPayoutCount += data.total_payout_count || 0;
      }
      //submerchants removed
      if (!subMerchantIds.has(merch.user_id)) {
        merchant.push({
          merchantId: merch.code,
          totalPayin: totalPayinAmount,
          totalPayinCount: totalPayinCount,
          totalPayout: totalPayoutAmount,
          totalPayoutCount: totalPayoutCount,
        });
      }

      totalpayinsMerchant += totalPayinAmount;
      totalpayoutsMerchant += totalPayoutAmount;
      merchant.sort((a, b) => a.merchantId.localeCompare(b.merchantId));
    }

    let vendorObjpayIn = {};
    let vendorObjpayOut = [];
    let totalBankDepositAllVendors = 0;
    let totalBankWithdrawalAllVendors = 0;

      const banksData = await getBankaccountDao(
        { bank_used_for: 'PayIn' },
        null,
        null,
        'ADMIN'
      );
    const banks = banksData
      .filter(({ today_balance }) => today_balance !== 0)
      .map(({ user_id,  nick_name, today_balance, payin_count }) => {
        totalBankDepositAllVendors += today_balance;
        return {
          user_id,
          bankName: nick_name,
          TotalDeposit: today_balance,
          TotalCount: payin_count,
        };
      });

    let vendorData

    for (const bank of banks) {
      vendorData= await getVendorsDao(
        { user_id: bank.user_id },
        null,
        null,
        'created_at',
        'DESC',
      );
      if (vendorData.length > 0) {
        const vendor = vendorData[0]; 
        const vendorCode = vendor.code;
    
        if (!vendorObjpayIn[vendorCode]) {
          vendorObjpayIn[vendorCode] = { banks: [] };
        }
    
        vendorObjpayIn[vendorCode].banks.push({
          bankName: bank.bankName,
          TotalDeposit: bank.TotalDeposit,
          TotalCount: bank.TotalCount,
        });
      }
    }
  
    // for (const vendorEntry of vendorEntries) {
    //   vendorObjpayIn[vendorEntry.code] = { banks: vendorEntry.banks };
    //   vendorArray.push({ banks: vendorEntry.banks });
    // }

    const banksDataOut = await getBankaccountDao(
      { bank_used_for: 'PayOut' },
      null,
      null,
      'ADMIN'
    );
    const banksOut = banksDataOut
    .filter(({ today_balance }) => today_balance !== 0)
    .map(({ user_id,  nick_name, today_balance, payin_count }) => {
      totalBankWithdrawalAllVendors += today_balance;
      return {
        user_id,
        bankName: nick_name,
        TotalDeposit: today_balance,
        TotalCount: payin_count,
      };
    });
    let vendorDataOut
    for(const banksO of banksOut){
      vendorDataOut= await getVendorsDao(
        { user_id: banksO.user_id },
        null,
        null,
        'created_at',
        'DESC',
      );
      if (vendorDataOut.length > 0) {
        const vendor = vendorDataOut[0]; 
        const vendorCode = vendor.code;
        if (!vendorObjpayOut[vendorCode]) {
          vendorObjpayOut[vendorCode] = { banks: [] };
        }
    
        vendorObjpayOut[vendorCode].banks.push({
          bankName: banksO.bankName,
          TotalDeposit: banksO.TotalDeposit,
          TotalCount: banksO.TotalCount,
        });
      }
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
        // merchants.forEach((merchant) => {
        //   const transactions = transactionsByMerchant[merchant.id];
        //   if (!transactions) {
        //     console.log(merchant.id, 'has no transactions available.');
        //   } else {
        //     console.log('transactions for merchant');
        //   }
        // });

        const fullMessages = [];
        for (const merchant of merchantsWithTransactions) {
          const merchantTransactions = transactionsByMerchant[merchant.id];

          const intervalDetails = intervals
            .map(({ label, duration }) => {
              const startTime = new Date(now - duration);

              const filteredTransactions = merchantTransactions.filter(
                (tx) => tx.updated_at >= startTime,
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
                (tx) => tx.updated_at >= startTime,
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
        logger.error('Error ', error.message);
      }
    };
    formattedSuccessRatiosByMerchant();
  } catch (error) {
    logger.error(error);
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

export default gatherAllData;
