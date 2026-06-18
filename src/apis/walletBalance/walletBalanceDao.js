import { executeQuery } from '../../utils/db.js';
import { tableName } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';

export const getLatestNetBalanceByMerchantUserIdDao = async (
  user_id,
  conn = null,
) => {
  try {
    if (!user_id) return null;
    const sql = `
      SELECT net_balance
      FROM "${tableName.CALCULATION}"
      WHERE is_obsolete = false
        AND user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const params = [user_id];
    const result = conn
      ? await conn.query(sql, params)
      : await executeQuery(sql, params, conn);

    return result?.rows?.[0]?.net_balance ?? null;
  } catch (error) {
    logger.error('Error in getLatestNetBalanceByMerchantUserIdDao:', error);
    throw error;
  }
};

