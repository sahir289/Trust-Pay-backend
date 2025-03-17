// Importing DAO functions for database operations
import {
  createCalculationDao,
  updateCalculationDao,
  deleteCalculationDao,
  getCalculationsSumDao,
} from './calculationDao.js';

// Importing transaction wrapper for handling database transactions
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import { InternalServerError } from '../../utils/appErrors.js';
// Service to fetch calculation data
const getCalculationService = async (filters, role) => {

  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CALCULATION
        : role === Role.VENDOR
          ? vendorColumns.CALCULATION
          : columns.CALCULATION;
          
    return await getCalculationsSumDao(
      { ...filters, role },
      null,
      null,
      null,
      null,
      filterColumns
    );
  } catch (error) {
    console.error('Error while fetching calculation data:', error);
    throw new InternalServerError(error);
  }
};

// Service to create a new calculation record
const createCalculationService = async (conn, payload, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CALCULATION
        : role === Role.VENDOR
          ? vendorColumns.CALCULATION
          : columns.CALCULATION;
    const data = await createCalculationDao(conn, payload); // Ensuring transaction safety
    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('Error while creating calculation record:', error);
    throw new InternalServerError(error);
  }
};

// Service to update an existing calculation record
const updateCalculationService = async (conn, filters, payload, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CALCULATION
        : role === Role.VENDOR
          ? vendorColumns.CALCULATION
          : columns.CALCULATION;
    const data = await updateCalculationDao(filters, payload, conn);
    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('Error while updating calculation record:', error);
    throw new InternalServerError(error);
  }
};

// Service to mark a calculation record as obsolete (soft delete)
const deleteCalculationService = async (conn, id, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CALCULATION
        : role === Role.VENDOR
          ? vendorColumns.CALCULATION
          : columns.CALCULATION;
    const userData = { is_obsolete: true };
    const data = await deleteCalculationDao(conn, id, userData);
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('Error while deleting calculation record:', error);
    throw new InternalServerError(error);
  }
};

// Exporting services for use in other modules
export {
  getCalculationService,
  createCalculationService,
  updateCalculationService,
  deleteCalculationService,
};
