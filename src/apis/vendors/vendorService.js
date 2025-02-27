import { columns, Role, vendorColumns } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { createVendorDao, deleteVendorDao, getVendorsDao, updateVendorDao } from './vendorDao.js';

const createVendorService = async (payload, roleIs) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction
        const filterColumns = roleIs === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;
        const data = await createVendorDao(payload);
        await commit(conn); // Commit the transaction
        console.log('Vendor created successfully', 'info');

        const finalResult =  filterResponse(data, filterColumns);
        return finalResult;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        console.log('Error while creating Vendor', 'error', error);
        throw new BadRequestError('Error occurred while creating Vendor');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                console.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
};

const getVendorsService = async (filters, roleIs) => {
    try {
        const filterColumns = roleIs === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;
        return await getVendorsDao(filters, null, null, null, null, filterColumns);
    } catch (error) {
        console.error('Error while fetching vendors', error);
        throw new BadRequestError('Error occurred while fetching vendors');
    }
};


const updateVendorService = async (id, payload, role) => {
    let conn;
    try {
        const filterColumns = role === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction
        const data = await updateVendorDao(id, payload,conn); // Adjust DAO call for update
        await commit(conn); // Commit the transaction
        console.log('Vendor updated successfully', 'info');
        const finalResult =  filterResponse(data, filterColumns);
        return finalResult;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        console.log('Error while updating Vendor', 'error', error);
        throw new BadRequestError('Error occurred while updating Vendor');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                console.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
};

const deleteVendorService = async (ids, role) => {
    let conn;
    try {
        const filterColumns = role === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;

        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction
        const payload = { is_obsolete: true };

        const data = await deleteVendorDao(ids, payload); // Adjust DAO call for delete

        await commit(conn); // Commit the transaction
        console.log('Vendor deleted successfully', 'info');

        const finalResult =  filterResponse(data, filterColumns);
        return finalResult;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        console.log('Error while deleting Vendor', 'error', error);
        throw new BadRequestError('Error occurred while deleting Vendor');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                console.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
};

export { createVendorService, getVendorsService, updateVendorService, deleteVendorService };
