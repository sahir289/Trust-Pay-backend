import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection, rollback, } from '../../utils/db.js';
import { createChargeBackDao, deleteChargeBackDao, getChargeBackDao, updateChargeBackDao } from './chargeBackDao.js';
import { columns, merchantColumns, Role, vendorColumns } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
const createChargeBackService = async (payload,role) => {
    let conn;
    try {
        const filterColumns = role === Role.MERCHANT ? merchantColumns.CHAREBACK : role === Role.VENDOR ? vendorColumns.CHAREBACK : columns.CHAREBACK;
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction
        const data = await createChargeBackDao(payload);
        await commit(conn); // Commit the transaction
        console.log('ChargeBack created successfully');
        const finalResult = await filterResponse(data, filterColumns);
        return finalResult;
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

const getChargeBacksService = async (filters, role) => {
    try {
        const filterColumns = role === Role.MERCHANT ? merchantColumns.CHAREBACK : role === Role.VENDOR ? vendorColumns.CHAREBACK : columns.CHAREBACK;
        const data = await getChargeBackDao(filters);
        console.log('Fetched ChargeBacks successfully');
        const finalResult = await filterResponse(data, filterColumns);
        return finalResult;   
     } catch (error) {
        console.error('Error while fetching ChargeBacks', error);
        throw new BadRequestError('Error occurred while fetching ChargeBacks');
    }
};

const updateChargeBackService = async (ids, payload,role) => {
    let conn;
    try {
        const filterColumns = role === Role.MERCHANT ? merchantColumns.CHAREBACK : role === Role.VENDOR ? vendorColumns.CHAREBACK : columns.CHAREBACK;
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction
        const data = await updateChargeBackDao(ids, payload); // Adjust DAO call for update
        await commit(conn); // Commit the transaction
        console.log('ChargeBack updated successfully');
        const finalResult = await filterResponse(data, filterColumns);
        return finalResult;  
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

const deleteChargeBackService = async (ids,role) => {
    let conn;
    try {
        const filterColumns = role === Role.MERCHANT ? merchantColumns.CHAREBACK : role === Role.VENDOR ? vendorColumns.CHAREBACK : columns.CHAREBACK;

        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction
        const payload = { is_obsolete: true };

        const data = await deleteChargeBackDao(ids, payload); // Adjust DAO call for delete
        await commit(conn); // Commit the transaction
        console.log('ChargeBack deleted successfully');
        const finalResult = await filterResponse(data, filterColumns);
        return finalResult;  
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
