import { executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

export const getSettingDao = async (key) => {
  try {
    const sql = `SELECT value FROM "SystemSettings" WHERE key = $1 AND is_obsolete = false`;
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
      INSERT INTO "SystemSettings" (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = $2
      RETURNING value
    `;
    const result = await executeQuery(sql, [key, JSON.stringify(value)]);
    return result.rows[0]?.value;
  } catch (error) {
    logger.error(`Error in updateSettingDao for key ${key}:`, error);
    throw error;
  }
};
