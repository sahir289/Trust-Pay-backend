import {
  buildInsertQuery,
  executeQuery,
} from '../../utils/db.js';
import { tableName,  } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { BadRequestError } from '../../utils/appErrors.js';

const getBankHistoryDao = async (filters, conn = null) => {
  try {
    if (!filters.bank_account_id || !filters.date) {
      throw new BadRequestError('bank_account_id and date are required');
    }
    const query = `
        SELECT count , today_balance FROM "${tableName.BANK_HISTORY}" 
        WHERE DATE(created_at) = $1 
        AND bank_account_id = $2 
        AND is_obsolete = false 
        ORDER BY created_at DESC
      `;
    const params = [filters.date, filters.bank_account_id];
    const result = await executeQuery(query, params, conn);
    return result.rows;
  } catch (error) {
    logger.error(`Error in getBankHistoryDao: ${error.message}`, {
      errorMetadata: error,
    });
    throw error;
  }
};
const getallBankHistoryDao = async (filters, conn = null) => {
  try {
    if (!filters.date) {
      throw new BadRequestError('bank_account_id and date are required');
    }
    const query = `
        SELECT count , today_balance FROM "${tableName.BANK_HISTORY}" 
        WHERE DATE(created_at) = $1 
        AND is_obsolete = false 
        ORDER BY created_at DESC
      `;
    const params = [filters.date];
    const result = await executeQuery(query, params, conn);
    return result.rows;
  } catch (error) {
    logger.error(`Error in getBankHistoryDao: ${error.message}`, {
      errorMetadata: error,
    });
    throw error;
  }
};

const createBankHistoryDao = async (data, conn = null) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.BANK_HISTORY, data);

    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in createBankHistoryDao:', error);
    throw error;
  }
};



export { getBankHistoryDao, createBankHistoryDao, getallBankHistoryDao };
