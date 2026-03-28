import moment from 'moment-timezone';
import {
  beginTransaction,
  commit,
  executeQuery,
  getConnection,
  rollback,
} from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { createBankHistoryService } from '../apis/bankHistory/bankHistorySevice.js';

const collectBankData = async (timezone = 'Asia/Kolkata') => {
  const startTime = moment().tz(timezone, true);
  const yesterdayDate = startTime
    .clone()
    .subtract(1, 'day')
    .format('YYYY-MM-DD');
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);

    //added payin_count to update everyday
    await createBankHistoryService(conn);
    const sql = `UPDATE public."BankAccount" SET today_balance = 0 , payin_count = 0  WHERE updated_at = $1`;
    await executeQuery(sql, [yesterdayDate], conn);

    await commit(conn);
    committed = true;

    logger.info(
      'Successfully updated today_balance for all bank accounts.',
      startTime,
    );
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error while updating bank account data:', error?.message);
    throw error; // Re-throw to ensure failure detection
  } finally {
    if (conn) conn.release();
  }
};

export default collectBankData;
