// import cron from 'node-cron';
import moment from 'moment-timezone';
import { getConnection, beginTransaction, commit, rollback } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { createBankHistoryService } from '../apis/bankHistory/bankHistorySevice.js';
import deleteUnauthorizedCompanies from './unauthorizedCompanyDeleteCron.js';

// if (process.env.NODE_ENV == 'production') {
//   logger.log('Running cron job in production environment');
//   cron.schedule(
//     '0 0 * * *',
//     () => {
//       collectBankData('Asia/Kolkata');
//     },
//     {
//       timezone: 'Asia/Kolkata',
//     },
//   );
// } else {
//   logger.error('Cron jobs are disabled in non-production environments.');
// }

const collectBankData = async (timezone = 'Asia/Kolkata') => {
  const startTime = moment().tz(timezone, true);
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    //added payin_count to update everyday
    await createBankHistoryService(conn);
    const sql =
      'UPDATE public."BankAccount" SET today_balance = 0 , payin_count = 0 ';
    await conn.query(sql);
    await commit(conn);
    committed = true;
    logger.info(
      'Successfully updated today_balance for all bank accounts.',
      startTime,
    );
    await deleteUnauthorizedCompanies();
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error while updating bank account data:', error?.message);
    throw error; // Re-throw to ensure failure detection
  } finally {
    if (conn) conn.release();
  }
};

export default collectBankData;
