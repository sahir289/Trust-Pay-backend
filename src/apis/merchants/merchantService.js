import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection } from '../../utils/db.js';
import Logger from '../../utils/logger.js';
import { createMerchantDao, deleteMerchantDao, getMerchantsDao, updateMerchantDao } from './merchantDao.js';

const logger = new Logger();

const createMerchantService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction

        const data = await createMerchantDao(conn, payload);

        await conn.commit(); // Commit the transaction
        logger.log('Merchant created successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while creating Merchant', 'error', error);
        throw new BadRequestError('Error occurred while creating Merchant');
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

const getMerchantsService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn);
        const data = await getMerchantsDao(conn, payload);
        await commit(conn); // Commit transaction (even if no modifications)

        logger.log('Fetched Merchants successfully', 'info');
        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction if an error occurs
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while fetching Merchants', 'error', error);
        throw new BadRequestError('Error occurred while fetching Merchants');
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

const updateMerchantService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction

        const data = await updateMerchantDao(conn, payload); // Adjust DAO call for update

        await conn.commit(); // Commit the transaction
        logger.log('Merchant updated successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while updating Merchant', 'error', error);
        throw new BadRequestError('Error occurred while updating Merchant');
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

const deleteMerchantService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction

        const data = await deleteMerchantDao(conn, payload); // Adjust DAO call for delete

        await conn.commit(); // Commit the transaction
        logger.log('Merchant deleted successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while deleting Merchant', 'error', error);
        throw new BadRequestError('Error occurred while deleting Merchant');
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

export { createMerchantService, getMerchantsService, updateMerchantService, deleteMerchantService};
