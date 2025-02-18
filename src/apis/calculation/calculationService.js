// Importing DAO functions for database operations
import { getCalculationDao, createCalculationDao, updateCalculationDao, deleteCalculationDao,  } from './calculationDao.js';

// Importing transaction wrapper for handling database transactions
import { transactionWrapper } from '../../utils/db.js';

// Service to fetch calculation data
const getCalculationService = async (payload) => {
  try {
    const data = await getCalculationDao(payload);
    return data;
  } catch (error) {
    console.error('Error while fetching calculation data:', error);
    throw new Error('Error occurred while fetching calculation data');
  }
};


// Service to create a new calculation record
const createCalculationService = async (payload) => {
  try {
    const data = await transactionWrapper(createCalculationDao)(payload); // Ensuring transaction safety
    return data;
  } catch (error) {
    console.error('Error while creating calculation record:', error);
    throw new Error('Error occurred while creating calculation record');
  }
};


// Service to update an existing calculation record
const updateCalculationService = async (user_id, payload) => {
  try {
    const data = await transactionWrapper(updateCalculationDao)(user_id, payload);
    return data;
  } catch (error) {
    console.error('Error while updating calculation record:', error);
    throw new Error('Error occurred while updating calculation record');
  }
};


// Service to mark a calculation record as obsolete (soft delete)
const deleteCalculationService = async (id) => {
  try {
    const userData = { is_obsolete: true };
    const data = await transactionWrapper(deleteCalculationDao)(id, userData);
    return data;
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
