import { getMerchantsForDashboardReportDao } from '../merchants/merchantDao.js';
import { getCalculationDashBoardReportDao } from '../calculation/calculationDao.js';
import { getBankaccountDashBoardReportDao } from '../bankAccounts/bankaccountDao.js';
import { sendTelegramDashboardReportMessage } from '../../utils/sendTelegramMessages.js';
import config from '../../config/config.js';
// import { getConnection } from '../../utils/db.js';
import { getVendorsDashBoardReportDao } from '../vendors/vendorDao.js';
import { logger } from '../../utils/logger.js';
import { getUserHierarchysDashBoardReportDao } from '../userHierarchy/userHierarchyDao.js';
import { getCompanyDao } from '../company/companyDao.js';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
// import gatherAllNetbalanceForAllCompanies from '../../cron/gatherAllNetBalance.js';
import { BadRequestError, NotFoundError } from '../../utils/appErrors.js';
import { getBankHistoryDao } from '../bankHistory/bankHistoryDao.js';
dayjs.extend(utc);
dayjs.extend(timezone);

const gatherDataForCompany = async (
    company_id,
    date,
    timezone = 'Asia/Kolkata',
  ) => {
    try {
      logger.info(
        `Starting gather data for company ${company_id} on date ${date}`,
      );
      if (!company_id || !date) {
        throw new BadRequestError('Company ID and date are required');
      }
      const inputDate = dayjs(date).tz(timezone);
      if (!inputDate.isValid()) {
        throw new BadRequestError('Invalid date format');
      }
      const today = dayjs().tz(timezone).startOf('day');
      const isToday = inputDate.startOf('day').isSame(today);
      const finalType = isToday ? 'H' : 'N';
      let sDate, eDate;
      if (finalType === 'H') {
        sDate = inputDate.startOf('day').toDate();
        eDate = inputDate.toDate();
      } else {
        sDate = inputDate.startOf('day').toDate();
        eDate = inputDate.endOf('day').toDate();
      }
      logger.info(
        `Dashboard Report started for company: ${company_id}, date: ${inputDate.format('YYYY-MM-DD')}, type: ${finalType}`,
      );
      const companies = await getCompanyDao({ id: company_id });
      const company = companies && companies.length > 0 ? companies[0] : null;
      if (!company) {
        logger.error(`Company not found: ${company_id}`);
        throw new NotFoundError(`Company not found: ${company_id}`);
      }
      const telegramDashboardChatId =
        company.config?.telegramDashboardChatId ||
        config?.telegramDashboardChatId;
     const telegramVendorboardChatId = company.config?.telegramVendorboardChatId || config?.telegramVendorboardChatId;
      const telegramBotToken =
        company.config?.telegramBotToken || config?.telegramBotToken;
  
      if (!telegramDashboardChatId || !telegramBotToken) {
        logger.warn(
          `Missing Telegram config for company ${company_id}, skipping report`,
        );
        throw new NotFoundError(
          `Missing Telegram configuration for company ${company_id}`,
        );
      }
      const merchants = await getMerchantsForDashboardReportDao({ company_id });
      let merchant = [];
      let totalpayinsMerchant = 0;
      let totalpayoutsMerchant = 0;
      const allHierarchies = await getUserHierarchysDashBoardReportDao({
        company_id,
      });
      const subMerchantIds = new Set();
      allHierarchies.forEach((hierarchy) => {
        const subMerchants = hierarchy?.config?.siblings?.sub_merchants || [];
        subMerchants.forEach((subMerchantId) =>
          subMerchantIds.add(subMerchantId),
        );
      });
      for (const merch of merchants) {
        let totalPayinAmount = 0;
        let totalPayinCount = 0;
        let totalPayoutAmount = 0;
        let totalPayoutCount = 0;
        const calculationData = await getCalculationDashBoardReportDao({
          user_id: merch.user_id,
          company_id,
          sDate,
          eDate,
        });
        for (const data of calculationData) {
          totalPayinAmount += data.total_payin_amount || 0;
          totalPayinCount += data.total_payin_count || 0;
          totalPayoutAmount += data.total_payout_amount || 0;
          totalPayoutCount += data.total_payout_count || 0;
        }
        const merchantHier = await getUserHierarchysDashBoardReportDao({
          user_id: merch.user_id,
          company_id,
        });
        const subMerchants =
          merchantHier.length > 0
            ? merchantHier[0]?.config?.siblings?.sub_merchants || []
            : [];
        if (subMerchants.length > 0) {
          for (const subMerchantId of subMerchants) {
            const subMerchantCalculationData =
              await getCalculationDashBoardReportDao({
                user_id: subMerchantId,
                company_id,
                sDate,
                eDate,
              });
            for (const data of subMerchantCalculationData) {
              totalPayinAmount += data.total_payin_amount || 0;
              totalPayinCount += data.total_payin_count || 0;
              totalPayoutAmount += data.total_payout_amount || 0;
              totalPayoutCount += data.total_payout_count || 0;
            }
          }
        }
        if (!subMerchantIds.has(merch.user_id)) {
          merchant.push({
            merchantId: merch.code,
            totalPayin: totalPayinAmount,
            totalPayinCount,
            totalPayout: totalPayoutAmount,
            totalPayoutCount,
          });
        totalpayinsMerchant += totalPayinAmount;
        totalpayoutsMerchant += totalPayoutAmount;
        }
        merchant.sort((a, b) => a.merchantId.localeCompare(b.merchantId));
      }
      let vendorObjpayIn = {};
      let vendorObjpayOut = {};
      let totalBankDepositAllVendors = 0;
      let totalBankWithdrawalAllVendors = 0;
      let banksData = await getBankaccountDashBoardReportDao({
        bank_used_for: 'PayIn',
        company_id,
      });
      let banks = [];
      for (const bank of banksData) {
        let balance = bank.today_balance;
        let payin_count = bank.payin_count || 0;
        if (!isToday) {
          const history = await getBankHistoryDao({
            bank_account_id: bank.id, 
            date: inputDate.format('YYYY-MM-DD'),
          });
          if (history.length > 0) {
            balance = history[0].today_balance || 0; 
            payin_count = history[0].count || 0; 
          } else {
            balance = 0; 
            payin_count = 0;
          }
        }
        if (balance !== 0) {
          totalBankDepositAllVendors += balance;
          banks.push({
            user_id: bank.user_id,
            bankName: bank.nick_name,
            TotalDeposit: balance,
            TotalCount: payin_count,
          });
        }
      }
      for (const bank of banks) {
        const vendorData = await getVendorsDashBoardReportDao({
          user_id: bank.user_id,
          company_id,
        });
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
      // Fetch PayOut bank data
      let banksDataOut = await getBankaccountDashBoardReportDao({
        bank_used_for: 'PayOut',
        company_id,
      });
      let banksOut = [];
      for (const bank of banksDataOut) {
        let balance = bank.today_balance;
        let payin_count = bank.payin_count || 0;
        if (!isToday) {
          const history = await getBankHistoryDao({
            bank_account_id: bank.id, 
            date: inputDate.format('YYYY-MM-DD'),
          });
          if (history.length > 0) {
            balance = history[0].today_balance || 0; 
            payin_count = history[0].count || 0; 
          } else {
            balance = 0; 
            payin_count = 0;
          }
        }
        if (balance !== 0) {
          totalBankWithdrawalAllVendors += balance;
          banksOut.push({
            user_id: bank.user_id,
            bankName: bank.nick_name,
            TotalDeposit: balance,
            TotalCount: payin_count,
          });
        }
      }
      for (const banksO of banksOut) {
        const vendorDataOut = await getVendorsDashBoardReportDao({
          user_id: banksO.user_id,
          company_id,
        });
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
        telegramDashboardChatId,
        merchant,
        totalpayinsMerchant,
        totalpayoutsMerchant,
        vendorObjpayIn,
        vendorObjpayOut,
        totalBankDepositAllVendors,
        totalBankWithdrawalAllVendors,
        telegramBotToken,
        finalType === 'H' ? 'Hourly Report' : 'Daily Report',
        date,
        telegramVendorboardChatId,
      );
      logger.info(
        `Dashboard Report completed for company: ${company_id}, date: ${inputDate.format('YYYY-MM-DD')}, type: ${finalType}`,
      );
      return {
        success: true,
        message: `Data gathered and report sent for company ${company_id} on ${inputDate.format('YYYY-MM-DD')}`,
      };
    } catch (error) {
      logger.error(
        `Error in gatherDataForCompany for company ${company_id}: ${error.message}`,
      );
      throw error;
    }
  };
  
  export default gatherDataForCompany;

