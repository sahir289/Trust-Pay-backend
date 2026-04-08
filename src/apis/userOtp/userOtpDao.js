import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  executeQuery,
  buildUpdateQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

const createUserOtpDao = async (payload, conn = null) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.USER_OTP, payload);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error(`Error creating OTP for user_id: ${payload.user_id}`, error);
    throw error;
  }
};
const getUserOtpDao = async (otp, conn = null) => {
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
    const result = await executeQuery(baseQuery, [otp], conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in getUserOtpDao:', error);
    throw error;
  }
};
const updateUserOtpDao = async (user_id, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.USER_OTP, data, user_id);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateUserOtpDao:', error);
    throw error;
  }
};

export { createUserOtpDao, updateUserOtpDao, getUserOtpDao };
