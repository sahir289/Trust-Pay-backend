import { tableName } from '../../constants/index.js';
import { executeQuery } from '../../utils/db.js';
import { stringifyJSON } from '../../utils/index.js';
import { logger } from '../../utils/logger.js';

const addLoginDao = async (
  user_id,
  config,
  company_id,
  sessionId,
  conn = null,
) => {
  try {
    // const id = generateUUID();
    const configData = stringifyJSON(config, (key, value) =>
      typeof value === 'object' && value !== null
        ? stringifyJSON(value)
        : value,
    );

    // First, ensure all existing sessions for this user are marked as obsolete
    const cleanupSql = `
      UPDATE public."AccessToken" 
      SET is_obsolete = true 
      WHERE user_id = $1 AND company_id = $2 AND is_obsolete = false
    `;

    await executeQuery(cleanupSql, [user_id, company_id], conn);

    // Now insert the new session
    const sql = `
      INSERT INTO public."AccessToken" (user_id, company_id, config, session_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, session_id
    `;
    const values = [user_id, company_id, configData, sessionId];

    const result = await executeQuery(sql, values, conn);

    return result.rows?.[0] || undefined;
  } catch (error) {
    logger.error('Error in adding login details', error);
    throw error;
  }
};

const getRefreshTokenDao = async (hashedToken, company_id, conn = null) => {
  try {
    const query = `SELECT user_id FROM access_tokens WHERE config->>'refresh_token' = $1 AND company_id=$2`;
    const result = await executeQuery(query, [hashedToken, company_id], conn);
    return result.rows?.[0] || undefined;
  } catch (error) {
    logger.error('Error in getting refresh token', error);
    throw error;
  }
};

const getLoginDao = async (user_id, company_id, conn = null) => {
  try {
    const query = `SELECT config FROM "${tableName.ACCESS_TOKEN}" WHERE user_id=$1 AND company_id=$2`;
    const result = await executeQuery(query, [user_id, company_id], conn);
    return result.rows?.[0] || undefined;
  } catch (error) {
    logger.error('Error in getting login details', error);
    throw error;
  }
};

const getSessionByIdDao = async (decodeToken, conn = null) => {
  try {
    const query = `SELECT session_id, config FROM "${tableName.ACCESS_TOKEN}" WHERE user_id=$1 AND company_id=$2 and is_obsolete = false`;

    const result = await executeQuery(query, [
          decodeToken.user_id,
          decodeToken.company_id,
        ], conn);
    return result.rows?.[0] || undefined;
  } catch (error) {
    logger.error('Error in getting session details', error);
    throw error;
  }
};

const updateSessionDao = async (user_id, company_id, session_id, config, conn = null) => {
  const configData = stringifyJSON(config, (key, value) =>
    typeof value === 'object' && value !== null ? stringifyJSON(value) : value,
  );
  try {
    const query = `UPDATE "${tableName.ACCESS_TOKEN}" 
                   SET config = $1 
                   WHERE user_id = $2 AND company_id = $3 AND session_id = $4 AND is_obsolete = false`;
    await executeQuery(query, [configData, user_id, company_id, session_id], conn);
  } catch (error) {
    logger.error('Error updating session', error);
    throw error;
  }
};

const deleteUserSessionsDao = async (user_id, company_id, session_id, conn = null) => {
  try {
    let query = `UPDATE "${tableName.ACCESS_TOKEN}" SET is_obsolete = true WHERE user_id = $1 AND company_id = $2`;
    const params = [user_id, company_id];

    if (session_id) {
      query += ` AND session_id = $3`;
      params.push(session_id);
    }

    const result = await executeQuery(query, params, conn);

    return result.rows;
  } catch (error) {
    logger.error('Error while deleting user session:', error);
    throw error;
  }
};

const changePasswordDao = async (id, password, conn = null) => {
  try {
    const query = `UPDATE "${tableName.USER}" SET password = $2 WHERE id = $1 RETURNING id`;
    const result = await executeQuery(query, [id, password], conn);
    return result;
  } catch (error) {
    logger.error('Getting error while deleting user session', error);
    throw error;
  }
};

const getAllActiveSessionsDao = async (user_id, company_id, conn = null) => {
  try {
    const query = `SELECT session_id, config, created_at FROM "${tableName.ACCESS_TOKEN}" WHERE user_id=$1 AND company_id=$2 AND is_obsolete = false ORDER BY created_at DESC`;
    const result = await executeQuery(query, [user_id, company_id], conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error in getting all active sessions', error);
    throw error;
  }
};

const getRoleByUserNameDao = async (userName, conn = null) => {
  try {
    const query = `
      SELECT d.designation ,r.role
      FROM "${tableName.USER}" u
      JOIN "${tableName.DESIGNATION}" d ON u.designation_id = d.id
      JOIN "${tableName.ROLE}" r ON u.role_id = r.id
      WHERE u.user_name = $1 AND u.is_obsolete = false
      LIMIT 1
    `;
    const result = await executeQuery(query, [userName], conn);
    return result.rows?.[0] || undefined;
  } catch (error) {
    logger.error('Error in getting user role by username', error);
    throw error;
  }
};

export {
  addLoginDao,
  getRefreshTokenDao,
  getLoginDao,
  getSessionByIdDao,
  updateSessionDao,
  deleteUserSessionsDao,
  changePasswordDao,
  getAllActiveSessionsDao,
  getRoleByUserNameDao,
};
