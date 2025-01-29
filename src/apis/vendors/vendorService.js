import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import Logger from '../../utils/logger.js';
import { createVendorDao, deleteVendorDao, getVendorsDao, updateVendorDao } from './vendorDao.js';

const logger = new Logger();

const createVendorService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction

        const data = await createVendorDao(conn, payload);

        await conn.commit(); // Commit the transaction
        logger.log('Vendor created successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while creating Vendor', 'error', error);
        throw new BadRequestError('Error occurred while creating Vendor');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                logger.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
};

const getVendorsService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction (even if read-only)

        const data = await getVendorsDao(conn, payload);

        await conn.commit(); // Commit transaction (even if no modifications)

        logger.log('Fetched Vendors successfully', 'info');
        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction if an error occurs
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while fetching Vendors', 'error', error);
        throw new BadRequestError('Error occurred while fetching Vendors');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                logger.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
};

const updateVendorService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction

        const data = await updateVendorDao(conn, payload); // Adjust DAO call for update

        await conn.commit(); // Commit the transaction
        logger.log('Vendor updated successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while updating Vendor', 'error', error);
        throw new BadRequestError('Error occurred while updating Vendor');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                logger.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
};

const deleteVendorService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction

        const data = await deleteVendorDao(conn, payload); // Adjust DAO call for delete

        await conn.commit(); // Commit the transaction
        logger.log('Vendor deleted successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while deleting Vendor', 'error', error);
        throw new BadRequestError('Error occurred while deleting Vendor');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                logger.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
};

export { createVendorService, getVendorsService, updateVendorService, deleteVendorService};
