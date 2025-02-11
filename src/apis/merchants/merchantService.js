import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { createMerchantDao, deleteMerchantDao, getMerchantsDao, updateMerchantDao } from './merchantDao.js';


const createMerchantService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction

        const data = await createMerchantDao(payload);

        await commit(conn); // Commit the transaction
        console.log('Merchant created successfully',);

        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
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

const getMerchantsService = async () => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn);
        const data = await getMerchantsDao();
        await commit(conn); // Commit transaction (even if no modifications)

        console.log('Fetched Merchants successfully');
        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction if an error occurs
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

const updateMerchantService = async (id, payload) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction

        const data = await updateMerchantDao(id, payload); // Adjust DAO call for update

        await commit(conn); // Commit the transaction
        console.log('Merchant updated successfully');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
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

const deleteMerchantService = async (id) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction
        const payload = { is_obsolete: true };

        const data = await deleteMerchantDao(id, payload); // Adjust DAO call for delete

        await commit(conn); // Commit the transaction
        console.log('Merchant deleted successfully');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
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
