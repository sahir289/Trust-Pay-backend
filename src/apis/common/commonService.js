import { getTotalCountDao } from './commonDao.js';

export const getTotalCountService = async (tableName, role, filters) => {
  try {
    return await getTotalCountDao(tableName, role, filters);
  } catch (error) {
    console.error(
      `Error in getTotalCountService for table ${tableName}:`,
      error,
    );
    throw error;
  }
};
