// Importing DAO functions for database operations
import { getCalculationDao, createCalculationDao, updateCalculationDao, deleteCalculationDao } from './calculationDao.js';

// Importing transaction wrapper for handling database transactions
import { transactionWrapper } from '../../utils/db.js';

// Service to fetch calculation data
const getCalculationService = async (payload) => {
    const data = await getCalculationDao(payload);
    return data;
};

// Service to create a new calculation record
const createCalculationService = async (payload) => {
    const data = await transactionWrapper(createCalculationDao)(payload); // Ensuring transaction safety
    return data;
};

// Service to update an existing calculation record
const updateCalculationService = async (user_id, payload) => {
    const data = await transactionWrapper(updateCalculationDao)(user_id, payload);
    return data;
};

// Service to mark a calculation record as obsolete (soft delete)
const deleteCalculationService = async (id) => {
    const userData = { is_obsolete: true };
    const data = await transactionWrapper(deleteCalculationDao)(id, userData);
    return data;
};

// Exporting services for use in other modules
export { getCalculationService, createCalculationService, updateCalculationService, deleteCalculationService };
