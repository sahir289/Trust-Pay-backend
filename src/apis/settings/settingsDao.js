import { executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

export const getSettingDao = async (key) => {
  try {
    const sql = `SELECT value FROM "SystemSettings" WHERE key = $1`;
    const result = await executeQuery(sql, [key]);
    return result.rows[0]?.value || null;
  } catch (error) {
    logger.error(`Error in getSettingDao for key ${key}:`, error);
    throw error;
  }
};

export const updateSettingDao = async (key, value) => {
  try {
    const sql = `
      INSERT INTO "SystemSettings" (key, value, updated_at)
      VALUES ($1, $2, now())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()
      RETURNING value
    `;
    const result = await executeQuery(sql, [key, JSON.stringify(value)]);
    return result.rows[0]?.value;
  } catch (error) {
    logger.error(`Error in updateSettingDao for key ${key}:`, error);
    throw error;
  }
};
