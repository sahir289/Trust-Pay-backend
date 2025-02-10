import {BadRequestError,} from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import Logger from '../../utils/logger.js';
import { getRoleDao,createRoleDao,updateRoleDao ,deleteRoleDao } from './rolesDao.js';
const logger = new Logger();


const getRoleService = async (payload) => {
    console.log('getRoles2');
    let conn;
    try {
        conn = await getConnection();
        const data = await getRoleDao(conn, payload);
        await conn.commit(); // Commit transaction (even if no modifications)
        logger.log('Fetched Roles successfully', 'info');
        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction if an error occurs
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while fetching Roles', 'error', error);
        throw new BadRequestError('Error occurred while fetching Roles');
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


const createRoleService = async (payload) => {
    console.log('createRole2');
    let conn;
    try {
        conn = await getConnection();
        const data = await createRoleDao(conn, payload);
        await conn.commit(); // Commit transaction (even if no modifications)
        logger.log('Created Role successfully', 'info');
        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction if an error occurs
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while creating Role', 'error', error);
        throw new BadRequestError('Error occurred while creating Role');
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


const updateRoleService = async (payload) => {  
    console.log('updateRole2');
    let conn;
    try {
        conn = await getConnection();
        const data = await updateRoleDao(conn, payload);
        await conn.commit(); // Commit transaction (even if no modifications)
        logger.log('Updated Role successfully', 'info');
        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction if an error occurs
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while updating Role', 'error', error);
        throw new BadRequestError('Error occurred while updating Role');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                logger.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
}


const deleteRoleService = async (payload) => {  
    console.log('updateRole2');
    let conn;
    try {
        conn = await getConnection();
        const data = await deleteRoleDao(conn, payload);
        await conn.commit(); // Commit transaction (even if no modifications)
        logger.log('Updated Role successfully', 'info');
        return data;
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback(); // Rollback the transaction if an error occurs
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while updating Role', 'error', error);
        throw new BadRequestError('Error occurred while updating Role');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                logger.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
}




export { getRoleService,createRoleService, updateRoleService, deleteRoleService };