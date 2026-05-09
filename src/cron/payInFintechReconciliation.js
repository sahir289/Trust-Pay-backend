import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { getCompanyDao } from '../apis/company/companyDao.js';
import { reconcilePayInFintechPendingPayouts } from '../payinfintech/payinfintech.js';

let payInFintechReconciliationCronJob = null;

// Only run cron jobs in production environment AND in the dedicated cron worker process
const isCronWorker = process.env.CRON_WORKER === 'true';

const runPayInFintechReconciliation = async () => {
  try {
    const companies = await getCompanyDao({});
    for (const company of companies) {
      const { id: companyId, config = {} } = company;
      
      // Only run if the company has PayInFintech configured
      if (!config.PAYINFINTECH) {
        continue;
      }
      
      await reconcilePayInFintechPendingPayouts(companyId);
    }
  } catch (error) {
    logger.error('Error while running PayInFintech reconciliation:', error.message);
  }
};

if (isCronWorker && process.env.NODE_ENV === 'production') {
  // Run every 5 minutes
  payInFintechReconciliationCronJob = cron.schedule('*/5 * * * *', runPayInFintechReconciliation);
  logger.info('PayInFintech reconciliation cron job initialized in cron worker');
}

export const stopPayInFintechReconciliationCron = () => {
  if (payInFintechReconciliationCronJob) {
    payInFintechReconciliationCronJob.stop();
    logger.info('PayInFintech reconciliation cron job stopped');
  }
};

export default runPayInFintechReconciliation;
