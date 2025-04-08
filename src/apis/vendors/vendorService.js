import { columns, Role, vendorColumns } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import { InternalServerError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

import {
  createVendorDao,
  deleteVendorDao,
  getVendorsCodeDao,
  getVendorsDao,
  getVendorsBySearchDao,
  updateVendorDao,
} from './vendorDao.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { createCalculationDao } from '../calculation/calculationDao.js';

const createVendorService = async (conn, payload, roleIs) => {
  try {
    const filterColumns =
      roleIs === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;
    let role_id = payload.role_id;
    delete payload.role_id;
    const data = await createVendorDao(payload, conn);
    const calculationPayload = {
      user_id: data.user_id,
      role_id:role_id,
      company_id: data.company_id,
    };
    await createCalculationDao(conn, calculationPayload);
    console.log('Vendor created successfully', 'info');
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.log('Error while creating Vendor', 'error', error);
    throw new InternalServerError(error);
  }
};

const getVendorsService = async (filters, roleIs, page, limit) => {
  try {
    const filterColumns =
      roleIs === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;
      const pageNumber = parseInt(page, 10) || 1;
      const pageSize = parseInt(limit, 10) || 10;
    return await getVendorsDao(filters , pageNumber, pageSize, null, null, filterColumns);
  } catch (error) {
    console.error('Error while fetching vendors', error);
    throw new InternalServerError(error);
  }
};

const getVendorsCodeService = async (company_id) => {
  let conn;
  try {
    conn = await getConnection(); // Get DB connection
    await beginTransaction(conn); // Start transaction

    const data = await getVendorsCodeDao(company_id, conn);

    await commit(conn); // Commit transaction
    return data;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback in case of error
      } catch (rollbackError) {
        console.error('Error during transaction rollback:', rollbackError);
      }
    }
    console.error('Error while fetching vendors:', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
         conn.release(); // Ensure connection is released
      } catch (releaseError) {
        console.error('Error releasing connection:', releaseError);
      }
    }
  }
};
const getVendorsBySearchService = async (
  filters,
  // designation,
  // user_id,
) => {
  try {
    const pageNum = parseInt(filters.page);
    const limitNum = parseInt(filters.limit);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }
    const searchTerms = filters.search
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);

    if (searchTerms.length === 0) {
      throw new BadRequestError('Please provide valid search terms');
    }
    const offset = (pageNum - 1) * limitNum;

    // const filterColumns =
    //   role === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;
    // TODO: add designation constants
   
    const data = await getVendorsBySearchDao(
      filters,
      searchTerms,
      limitNum,
      offset,
      // filterColumns,
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching vendors by search', error);
    throw new InternalServerError(error.message);
  }
};

const updateVendorService = async (id, payload, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const data = await updateVendorDao(id, payload, conn); // Adjust DAO call for update
    await commit(conn); // Commit the transaction
    console.log('Vendor updated successfully', 'info');
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        console.log(
          'Error during transaction rollback',
          'error',
          rollbackError,
        );
      }
    }
    console.log('Error while updating Vendor', 'error', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        console.log(
          'Error while releasing the connection',
          'error',
          releaseError,
        );
      }
    }
  }
};

const deleteVendorService = async (ids, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;

    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const payload = { is_obsolete: true };
    const data = await deleteVendorDao(ids, payload); // Adjust DAO call for delete
    await commit(conn); // Commit the transaction
    console.log('Vendor deleted successfully', 'info');
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        console.log(
          'Error during transaction rollback',
          'error',
          rollbackError,
        );
      }
    }
    console.log('Error while deleting Vendor', 'error', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        console.log(
          'Error while releasing the connection',
          'error',
          releaseError,
        );
      }
    }
  }
};

export {
  createVendorService,
  getVendorsService,
  updateVendorService,
  deleteVendorService,
  getVendorsBySearchService,
  getVendorsCodeService
};
