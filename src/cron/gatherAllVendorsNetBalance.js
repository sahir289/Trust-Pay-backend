import { sendTelegramVendorDashboardReportMessage } from '../utils/sendTelegramMessages.js';
import config from '../config/config.js';
import { getConnection } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { getCompanyDao } from '../apis/company/companyDao.js';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { getVendorNetBalanceDao } from '../apis/calculation/calculationDao.js';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Function to gather data for all companies
const gatherAllVendorsNetbalanceForAllCompanies = async (type = 'N', timezone = 'Asia/Kolkata') => {
  try {
    logger.info('Starting gather data for all companies');
    
    // Get all companies
    const companies = await getCompanyDao({});
    
    if (!companies || companies.length === 0) {
      logger.info('No companies found');
      return;
    }

    // Process each company (sequential processing for safety)
    // for (const company of companies) {
    //   try {
    //     logger.info(`Processing company: ${company.id}`);
    //     await gatherAllVendorsNetBalance(company.id, type, timezone);
    //   } catch (error) {
    //     logger.error(`Error processing company ${company.id}: ${error}`);
    //   }
    // }
    
    // Parallel processing with 1-second delay after every 5 gatherAllVendorsNetBalance calls
    const batchSize = 5;
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (company) => {
          try {
            logger.info(`Processing company: ${company.id}`);
            await gatherAllVendorsNetBalance(company.id, type, timezone);
          } catch (error) {
            logger.error(`Error processing company ${company.id}: ${error}`);
          }
        })
      );
      // Add a 1-second delay after every batch except the last
      if (i + batchSize < companies.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    
    logger.info('Completed gather vendors net balance for all companies');
  } catch (error) {
    logger.error(`Error in gatherAllVendorsNetbalanceForAllCompanies: ${error}`);
  }
};

const gatherAllVendorsNetBalance = async (company_id, type = 'N', timezone = 'Asia/Kolkata') => {
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

    logger.info(`Vendor Net Balance Report CRON Started for company: ${company_id}`);
    
    // Get company details with config
    const companies = await getCompanyDao({ id: company_id });
    const company = companies && companies.length > 0 ? companies[0] : null;
    
    if (!company) {
      logger.error(`Company not found: ${company_id}`);
      return;
    }

    // Get company-specific configurations or fallback to global config
    const telegramVendorReportChatId = company.config?.telegramVendorReportChatId || config?.telegramVendorReportChatId;
    const telegramBotToken = company.config?.telegramBotToken || config?.telegramBotToken;

    if (!telegramVendorReportChatId || !telegramBotToken) {
      logger.warn(`Missing Telegram config for company ${company_id}, skipping report`);
      return;
    }

    // Get vendor net balance data using the new DAO
    const vendorBalanceData = await getVendorNetBalanceDao(company_id, sDate, eDate);

    if (!vendorBalanceData || vendorBalanceData.length === 0) {
      logger.info(`No vendor net balance data found for company ${company_id}`);
      // Still send a report indicating no vendors found
    }
    await sendTelegramVendorDashboardReportMessage(
      telegramVendorReportChatId,
      vendorBalanceData,
      telegramBotToken,
      type === 'H' ? 'Hourly Report' : 'Daily Report',
    );

    logger.info(`Vendor net balance report sent for company ${company_id} with ${vendorBalanceData.length} vendors`);

    logger.info(`Vendor Net Balance Report CRON Ended for company: ${company_id}`);
  } catch (error) {
    logger.error(`Error in gatherAllVendorsNetBalance for company ${company_id}: ${error}`);
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

export default gatherAllVendorsNetbalanceForAllCompanies;
