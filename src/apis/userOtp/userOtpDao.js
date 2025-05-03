import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  executeQuery,
  buildUpdateQuery,
} from '../../utils/db.js';

const createUserOtpDao = async (payload, conn) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.USER_OTP, payload);
    let result;
    if (conn) {
      result = await conn.query(sql, params);
    } else {
      result = await executeQuery(sql, params);
    }
    console.log(`OTP for user_id: ${payload.user_id} created successfully`);
    return result.rows[0];
  } catch (error) {
    console.error(`Error creating OTP for user_id: ${payload.user_id}`, error);
    throw error.message;
  }
};
const getUserOtpDao = async (otp) => {
  try {
    const baseQuery = `
  SELECT 
   id,
   user_id,
   is_used,
   otp,
   expiration_time,
   created_at,
   updated_at
FROM public."UserOtp"
WHERE otp = $1
ORDER BY created_at DESC
LIMIT 1
`;
      const result = await executeQuery(baseQuery, [otp]);
      console.log(result.rows, 'hey result from the result of data');
    return result.rows[0];
  } catch (error) {
    console.error('Error in getUserOtpDao:', error);
    throw error.message;
  }
};
const updateUserOtpDao = async (user_id, data, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.USER_OTP, data, user_id);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in updateUserOtpDao:', error);
    throw error.message;
  }
};


export { createUserOtpDao, updateUserOtpDao, getUserOtpDao };
