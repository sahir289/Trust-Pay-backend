import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection } from '../../utils/db.js';
import { createMerchantDao, deleteMerchantDao, getMerchantsDao, updateMerchantDao } from './merchantDao.js';


const createMerchantService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction

        const data = await createMerchantDao(conn, payload);

        await conn.commit(); // Commit the transaction
        console.log('Merchant created successfully',);

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.error('Error during transaction rollback', rollbackError);
            }
        }
        console.error('Error while creating Merchant', error);
        throw new BadRequestError('Error occurred while creating Merchant');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                console.error('Error while releasing the connection', releaseError);
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

        console.log('Fetched Merchants successfully');
        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction if an error occurs
            } catch (rollbackError) {
                console.error('Error during transaction rollback', rollbackError);
            }
        }
        console.error('Error while fetching Merchants', error);
        throw new BadRequestError('Error occurred while fetching Merchants');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                console.error('Error while releasing the connection', releaseError);
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
        console.log('Merchant updated successfully');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.error('Error during transaction rollback', rollbackError);
            }
        }
        console.error('Error while updating Merchant', error);
        throw new BadRequestError('Error occurred while updating Merchant');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                console.error('Error while releasing the connection', releaseError);
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
        console.log('Merchant deleted successfully');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.error('Error during transaction rollback', rollbackError);
            }
        }
        console.error('Error while deleting Merchant',  error);
        throw new BadRequestError('Error occurred while deleting Merchant');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                console.error('Error while releasing the connection', releaseError);
            }
        }
    }
};

export { createMerchantService, getMerchantsService, updateMerchantService, deleteMerchantService};
