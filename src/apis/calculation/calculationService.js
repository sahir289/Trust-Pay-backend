// Importing DAO functions for database operations
import { getCalculationDao, createCalculationDao, updateCalculationDao, deleteCalculationDao,  } from './calculationDao.js';

// Importing transaction wrapper for handling database transactions
import { transactionWrapper } from '../../utils/db.js';
import { columns, merchantColumns, Role, vendorColumns } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';

// Service to fetch calculation data
const getCalculationService = async (filters, role) => {
  try {
  const filterColumns = role === Role.MERCHANT ? merchantColumns.CALCULATION : role === Role.VENDOR ? vendorColumns.CALCULATION : columns.CALCULATION; 
    const data = await getCalculationDao(filters);
    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('Error while fetching calculation data:', error);
    throw new Error('Error occurred while fetching calculation data');
  }
};


// Service to create a new calculation record
const createCalculationService = async (payload, role) => {
  try {
    const filterColumns = role === Role.MERCHANT ? merchantColumns.CALCULATION : role === Role.VENDOR ? vendorColumns.CALCULATION : columns.CALCULATION; 
    const data = await transactionWrapper(createCalculationDao)(payload); // Ensuring transaction safety
    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('Error while creating calculation record:', error);
    throw new Error('Error occurred while creating calculation record');
  }
};


// Service to update an existing calculation record
const updateCalculationService = async (conn,id,payload, role) => {
  try {
    const filterColumns = role === Role.MERCHANT ? merchantColumns.CALCULATION : role === Role.VENDOR ? vendorColumns.CALCULATION : columns.CALCULATION; 
    const data = await updateCalculationDao(conn,id, payload);
    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('Error while updating calculation record:', error);
    throw new Error('Error occurred while updating calculation record');
  }
};


// Service to mark a calculation record as obsolete (soft delete)
const deleteCalculationService = async (conn,id, role) => {
  try {
    const filterColumns = role === Role.MERCHANT ? merchantColumns.CALCULATION : role === Role.VENDOR ? vendorColumns.CALCULATION : columns.CALCULATION; 
    const userData = { is_obsolete: true };
    const data = await deleteCalculationDao(conn,id, userData);
    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('Error while deleting calculation record:', error);
    throw new Error('Error occurred while deleting calculation record');
  }
};


// Exporting services for use in other modules
export { 
  getCalculationService, 
  createCalculationService, 
  updateCalculationService, 
  deleteCalculationService, 
};
