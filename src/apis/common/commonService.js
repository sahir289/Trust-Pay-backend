import { getTotalCountDao } from './commonDao.js';

export const getTotalCountService = async (tableName) => {
  try {
    return await getTotalCountDao(tableName);
  } catch (error) {
    console.error(`Error in getTotalCountService for table ${tableName}:`, error);
    throw error;
  }
};
