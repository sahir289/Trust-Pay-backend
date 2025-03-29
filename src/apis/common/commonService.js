import { getTotalCountDao } from './commonDao.js';

export const getTotalCountService = async (tableName, role) => {
  try {
    return await getTotalCountDao(tableName, role);
  } catch (error) {
    console.error(`Error in getTotalCountService for table ${tableName}:`, error);
    throw error;
  }
};
