import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import Logger from '../../utils/logger.js';
import { createVendorDao, deleteVendorDao, getVendorsDao, updateVendorDao } from './vendorDao.js';

const logger = new Logger();

const createChargeBackService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction

        const data = await createVendorDao(conn, payload);

        await conn.commit(); // Commit the transaction
        logger.log('ChargeBack created successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while creating ChargeBack', 'error', error);
        throw new BadRequestError('Error occurred while creating ChargeBack');
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

const getChargeBacksService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction (even if read-only)

        const data = await getVendorsDao(conn, payload);

        await conn.commit(); // Commit transaction (even if no modifications)

        logger.log('Fetched ChargeBacks successfully', 'info');
        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction if an error occurs
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while fetching ChargeBacks', 'error', error);
        throw new BadRequestError('Error occurred while fetching ChargeBacks');
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

const updateChargeBackService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction

        const data = await updateVendorDao(conn, payload); // Adjust DAO call for update

        await conn.commit(); // Commit the transaction
        logger.log('ChargeBack updated successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while updating ChargeBack', 'error', error);
        throw new BadRequestError('Error occurred while updating ChargeBack');
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

const deleteChargeBackService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction

        const data = await deleteVendorDao(conn, payload); // Adjust DAO call for delete

        await conn.commit(); // Commit the transaction
        logger.log('ChargeBack deleted successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while deleting ChargeBack', 'error', error);
        throw new BadRequestError('Error occurred while deleting ChargeBack');
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

export { createChargeBackService, getChargeBacksService, updateChargeBackService, deleteChargeBackService};
