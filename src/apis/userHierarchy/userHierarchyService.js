import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { createUserHierarchyDao, deleteUserHierarchyDao, getUserHierarchysDao, updateUserHierarchyDao } from './userHierarchyDao.js';

const createUserHierarchyService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction

        const data = await createUserHierarchyDao(payload);

        await commit(conn); // Commit the transaction
        console.log('UserHierarchy created successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        console.log('Error while creating UserHierarchy', 'error', error);
        throw new BadRequestError('Error occurred while creating UserHierarchy');
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

const getUserHierarchyService = async (payload) => {
    const data = await getUserHierarchysDao(payload);

    console.log('Fetched UserHierarchys successfully', 'info');
    return data;
};

const updateUserHierarchyService = async (id, payload) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction

        const data = await updateUserHierarchyDao(id, payload); // Adjust DAO call for update

        await commit(conn); // Commit the transaction
        console.log('UserHierarchy updated successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        console.log('Error while updating UserHierarchy', 'error', error);
        throw new BadRequestError('Error occurred while updating UserHierarchy');
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

const deleteUserHierarchyService = async (id) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction
        const payload = { is_obsolete: true };

        const data = await deleteUserHierarchyDao(id, payload); // Adjust DAO call for delete

        await commit(conn); // Commit the transaction
        console.log('UserHierarchy deleted successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        console.log('Error while deleting UserHierarchy', 'error', error);
        throw new BadRequestError('Error occurred while deleting UserHierarchy');
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

export { createUserHierarchyService, getUserHierarchyService, updateUserHierarchyService, deleteUserHierarchyService };
