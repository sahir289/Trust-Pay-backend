
import moment from 'moment-timezone';
import { getConnection } from '../utils/db.js';
import { logger } from '../utils/logger.js';

const deleteUnauthorizedCompanies = async (timezone = 'Asia/Kolkata') => {
  const startTime = moment().tz(timezone, true);
  let conn;
  try {
    conn = await getConnection();
    const sql = `UPDATE public."Company" SET is_obsolete = true WHERE "Company".config->>'authorized' = 'false' AND "Company".created_at < (NOW()) - INTERVAL '7 days'`;
    await conn.query(sql);
    logger.info(
      'Successfully deleted unauthorized companies.',
      startTime,
    );
  } catch (error) {
    logger.error('Error while deleting unauthorized companies:', error?.message);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error releasing DB connection:', releaseError?.message);
      }
    }
  }
};
export default deleteUnauthorizedCompanies;