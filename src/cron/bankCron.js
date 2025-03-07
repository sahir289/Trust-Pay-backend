import cron from 'node-cron';
import moment from 'moment-timezone';
import { getConnection } from '../utils/db.js';

cron.schedule(
  '0 0 * * *',
  () => {
    collectBankData('Asia/Kolkata');
  },
  {
    timezone: 'Asia/Kolkata',
  },
);

const collectBankData = async (timezone = 'Asia/Kolkata') => {
  const startTime = moment().tz(timezone, true);
  let conn;
  try {
    conn = await getConnection();
    const sql = 'UPDATE public."BankAccount" SET today_balance = 0';
    await conn.query(sql);
    console.info(
      'Successfully updated today_balance for all bank accounts.',
      startTime,
    );
  } catch (error) {
    console.error('Error while updating bank account data:', error?.message);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error('Error releasing DB connection:', releaseError?.message);
      }
    }
  }
};
export default collectBankData;
