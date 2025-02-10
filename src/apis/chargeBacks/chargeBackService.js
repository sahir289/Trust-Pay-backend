import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import { createChargeBackDao, deleteChargeBackDao, getChargeBackDao, updateChargeBackDao } from './chargeBackDao.js';


const createChargeBackService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction

        const data = await createChargeBackDao(conn, payload);

        await conn.commit(); // Commit the transaction
        console.log('ChargeBack created successfully');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.error('Error during transaction rollback', rollbackError);
            }
        }
        console.error('Error while creating ChargeBack', error);
        throw new BadRequestError('Error occurred while creating ChargeBack');
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

const getChargeBacksService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction (even if read-only)

        const data = await getChargeBackDao(conn, payload);

        await conn.commit(); // Commit transaction (even if no modifications)

        console.log('Fetched ChargeBacks successfully');
        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction if an error occurs
            } catch (rollbackError) {
                console.error('Error during transaction rollback', rollbackError);
            }
        }
        console.error('Error while fetching ChargeBacks', error);
        throw new BadRequestError('Error occurred while fetching ChargeBacks');
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

const updateChargeBackService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction

        const data = await updateChargeBackDao(conn, payload); // Adjust DAO call for update

        await conn.commit(); // Commit the transaction
        console.log('ChargeBack updated successfully');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.error('Error during transaction rollback', rollbackError);
            }
        }
        console.error('Error while updating ChargeBack', error);
        throw new BadRequestError('Error occurred while updating ChargeBack');
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

const deleteChargeBackService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction(); // Start a transaction

        const data = await deleteChargeBackDao(conn, payload); // Adjust DAO call for delete

        await conn.commit(); // Commit the transaction
        console.log('ChargeBack deleted successfully');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.error('Error during transaction rollback', rollbackError);
            }
        }
        console.error('Error while deleting ChargeBack', error);
        throw new BadRequestError('Error occurred while deleting ChargeBack');
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

export { createChargeBackService, getChargeBacksService, updateChargeBackService, deleteChargeBackService};
