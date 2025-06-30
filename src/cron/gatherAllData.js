import cron from 'node-cron';
import { getMerchantsDao } from '../apis/merchants/merchantDao.js';
import { getCalculationDao } from '../apis/calculation/calculationDao.js';
import { getBankaccountDao } from '../apis/bankAccounts/bankaccountDao.js';
import { sendTelegramDashboardReportMessage } from '../utils/sendTelegramMessages.js';
import config from '../config/config.js';
import { getConnection } from '../utils/db.js';
import { getVendorsDao } from '../apis/vendors/vendorDao.js';
import { logger } from '../utils/logger.js';
import { getUserHierarchysDao } from '../apis/userHierarchy/userHierarchyDao.js';
import dayjs from 'dayjs';
import collectBankData from './bankCron.js';

//run only on server - side /production level
if (process.env.NODE_ENV === 'production') {
  cron.schedule('0 0 * * *', () => {
    logger.info('Running  geatherall cron job in production environmenttt');
    gatherAllData('N', 'Asia/Kolkata');
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

    logger.info('Dashboard Report CRON Started');
    const merchants = await getMerchantsDao({}, null, null);
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
      'ADMIN',
    );
    const banks = banksData
      .filter(({ today_balance }) => today_balance !== 0)
      .map(({ user_id, nick_name, today_balance, payin_count }) => {
        totalBankDepositAllVendors += today_balance;
        return {
          user_id,
          bankName: nick_name,
          TotalDeposit: today_balance,
          TotalCount: payin_count,
        };
      });

    let vendorData;

    for (const bank of banks) {
      vendorData = await getVendorsDao(
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

    const banksDataOut = await getBankaccountDao(
      { bank_used_for: 'PayOut' },
      null,
      null,
      'ADMIN',
    );
    const banksOut = banksDataOut
      .filter(({ today_balance }) => today_balance !== 0)
      .map(({ user_id, nick_name, today_balance, payin_count }) => {
        totalBankWithdrawalAllVendors += today_balance;
        return {
          user_id,
          bankName: nick_name,
          TotalDeposit: today_balance,
          TotalCount: payin_count,
        };
      });
    let vendorDataOut;
    for (const banksO of banksOut) {
      vendorDataOut = await getVendorsDao(
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
    logger.info('Dashboard Report CRON Ended');
    if (type === 'N') {
      logger.info('Bank CRON Started');
      await collectBankData('Asia/Kolkata');
      logger.info('Bank CRON Ended');
    }
  } catch (error) {
    logger.error(`Error in gatherAllData: ${error}`);
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

export default gatherAllData;
