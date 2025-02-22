import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { createVendorDao, deleteVendorDao, getVendorsDao, updateVendorDao } from './vendorDao.js';

const createVendorService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction

        const data = await createVendorDao(payload);

        await commit(conn); // Commit the transaction
        console.log('Vendor created successfully', 'info');

        return data;
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

const getVendorsService = async (search,payload) => {
    try {
        const data = await getVendorsDao(search,payload);
        console.log('Fetched Vendors successfully', 'info');
        return data;
    } catch (error) {
        console.error('Error while fetching vendors', error);
        throw new BadRequestError('Error occurred while fetching vendors');
    }
};


const updateVendorService = async (id,company_id, payload) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction

        const data = await updateVendorDao(id,company_id,payload); // Adjust DAO call for update

        await commit(conn); // Commit the transaction
        console.log('Vendor updated successfully', 'info');

        return data;
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

const deleteVendorService = async (id,company_id) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction
        const payload = { is_obsolete: true };

        const data = await deleteVendorDao(id,company_id,payload); // Adjust DAO call for delete

        await commit(conn); // Commit the transaction
        console.log('Vendor deleted successfully', 'info');

        return data;
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
