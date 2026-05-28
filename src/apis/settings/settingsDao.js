import { executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

// Get 2FA enforcement from company config
export const get2FAEnforcementDao = async (company_id, conn = null) => {
  try {
    const sql = `SELECT config FROM "Company" WHERE id = $1 AND is_obsolete = false`;
    const result = await executeQuery(sql, [company_id], conn);
    const config = result.rows[0]?.config || {};
    return config.two_factor_enforcement === true;
  } catch (error) {
    logger.error(`Error in get2FAEnforcementDao for company ${company_id}:`, error);
    throw error;
  }
};

// Update 2FA enforcement in company config
export const update2FAEnforcementDao = async (company_id, enabled, conn = null) => {
  try {
    const sql = `
      UPDATE "Company"
      SET config = config || $1::json,
          updated_at = NOW()
      WHERE id = $2 AND is_obsolete = false
      RETURNING id, config
    `;
    const result = await executeQuery(
      sql,
      [JSON.stringify({ two_factor_enforcement: enabled }), company_id],
      conn
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error(`Error in update2FAEnforcementDao for company ${company_id}:`, error);
    throw error;
  }
};
