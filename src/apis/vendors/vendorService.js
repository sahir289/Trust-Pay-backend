import { columns, Role, vendorColumns } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import { InternalServerError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import {
  createVendorDao,
  deleteVendorDao,
  getVendorsCodeDao,
  getVendorsDao,
  updateVendorDao,
} from './vendorDao.js';
import { createCalculationDao } from '../calculation/calculationDao.js';
const createVendorService = async (conn, payload, roleIs) => {
  try {
    const filterColumns =
      roleIs === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;
    const data = await createVendorDao(payload, conn);
    const calculationPayload = {
      role_id: data.role_id,
      user_id: data.user_id,
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

const getVendorsService = async (filters, roleIs) => {
  try {
    const filterColumns =
      roleIs === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;
    return await getVendorsDao(filters, null, null, null, null, filterColumns);
  } catch (error) {
    console.error('Error while fetching vendors', error);
    throw new InternalServerError(error);
  }
};

const getVendorsCodeService = async (filters) => {
  try {
    return await getVendorsCodeDao(filters, null, null, null, null, null);
  } catch (error) {
    console.error('Error while fetching vendors', error);
    throw new InternalServerError(error);
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
  getVendorsCodeService
};
