import { DbError } from '../../utils/appErrors.js';
import { generateUUID } from '../../utils/generateUUID.js';


const addLoginDao = async (conn, payload) => {
    const { userId, companyId, refreshToken, refreshTokenExpiry } = payload
  try {
    const id = generateUUID();
    const configData = JSON.stringify(payload.config);
    const sql = `
      INSERT INTO login (id, username, is_obsolete, company, config, refresh_token, refresh_token_expiry)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
    `;
    const values = [id, userId, false, companyId, configData, refreshToken, refreshTokenExpiry];
    const result = await conn.query(sql, values);
    return result.rows?.[0] || undefined;
  } catch (error) {
    console.error('Error in addLoginDao', error);
    throw new DbError('Error executing query to add login info');
  }
};

export { addLoginDao };