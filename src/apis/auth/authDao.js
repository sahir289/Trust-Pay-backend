import { DbError } from '../../utils/appErrors.js';
import { executeQuery } from '../../utils/db.js';
import { generateUUID } from '../../utils/generateUUID.js';

const tableName = 'AccessToken';

const addLoginDao = async (conn, user_id, config, company_id) => {
  try {
    const id = generateUUID();
    const configData = JSON.stringify(config);
    const sql = `
      INSERT INTO public."AccessToken" (id, user_id, company_id, config)
      VALUES ($1, $2, $3, $4) RETURNING *
    `;
    const values = [id, user_id, company_id, configData];
    const result = await conn.query(sql, values);
    return result.rows?.[0] || undefined;
  } catch (error) {
    console.error('Error in adding login details', error);
    throw new DbError('Error executing query to add login info');
  }
};

const getLoginDao = async (user_id, company_id) => {
  try {
    const query = `SELECT config FROM "${tableName}" WHERE user_id=$1 AND company_id=$2`;
    const result = await executeQuery(query, [user_id, company_id]);
    return result.rows?.[0] || undefined;
  } catch (error) {
    console.error('Error in adding login details', error);
    throw new DbError('Error executing query to add login info');
  }
};

export { addLoginDao, getLoginDao };