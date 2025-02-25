import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection, rollback, } from '../../utils/db.js';
import { createChargeBackDao, deleteChargeBackDao, getChargeBackDao, updateChargeBackDao } from './chargeBackDao.js';

const createChargeBackService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction
        const data = await createChargeBackDao(payload);
        await commit(conn); // Commit the transaction
        console.log('ChargeBack created successfully');
        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.error('Error during transaction rollback', rollbackError);
            }
        }
        console.error('Error while creating ChargeBack', error);
        throw new BadRequestError('Error occurred while creating ChargeBack');
    } finally {
        if (conn) {
            try {
                rollback(conn); // Release the connection back to the pool
            } catch (releaseError) {
                console.error('Error while releasing the connection', releaseError);
            }
        }
    }
};

const getChargeBacksService = async (filters) => {
    try {
        const data = await getChargeBackDao(filters);
        console.log('Fetched ChargeBacks successfully');
        return data;
    } catch (error) {
        console.error('Error while fetching ChargeBacks', error);
        throw new BadRequestError('Error occurred while fetching ChargeBacks');
    }
};

const updateChargeBackService = async (id, company_id, payload) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction

        const data = await updateChargeBackDao(id, company_id, payload); // Adjust DAO call for update

        await commit(conn); // Commit the transaction
        console.log('ChargeBack updated successfully');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.error('Error during transaction rollback', rollbackError);
            }
        }
        console.error('Error while updating ChargeBack', error);
        throw new BadRequestError('Error occurred while updating ChargeBack');
    } finally {
        if (conn) {
            try {
                rollback(conn); // Release the connection back to the pool
            } catch (releaseError) {
                console.error('Error while releasing the connection', releaseError);
            }
        }
    }
};

const deleteChargeBackService = async (id, company_id) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction
        const payload = { is_obsolete: true };

        const data = await deleteChargeBackDao(id, company_id, payload); // Adjust DAO call for delete

        await commit(conn); // Commit the transaction
        console.log('ChargeBack deleted successfully');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.error('Error during transaction rollback', rollbackError);
            }
        }
        console.error('Error while deleting ChargeBack', error);
        throw new BadRequestError('Error occurred while deleting ChargeBack');
    } finally {
        if (conn) {
            try {
                rollback(conn); // Release the connection back to the pool
            } catch (releaseError) {
                console.error('Error while releasing the connection', releaseError);
            }
        }
    }
};

export { createChargeBackService, getChargeBacksService, updateChargeBackService, deleteChargeBackService };
