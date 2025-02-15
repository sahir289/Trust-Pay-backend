import {BadRequestError,} from '../../utils/appErrors.js';
import { getRoleDao,createRoleDao,updateRoleDao,deleteRoleDao } from './rolesDao.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';


const getRoleService = async (payload) => {
    let conn;
   try{
    conn = await getConnection();
    await beginTransaction(conn); 
    const data = await getRoleDao(payload);
    await commit(conn); 
    return data;
   }
   catch (error) {
    if (conn) {
        try {
            await rollback(conn); // Rollback the transaction in case of error
        } catch (rollbackError) {
            console.error('Error during transaction rollback', rollbackError);
        }
    }
    console.error('Error while Getting Role', error);
    throw new BadRequestError('Error occurred while Getting Role');
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



const createRoleService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); 
        const data = await createRoleDao(payload);
        console.log('Created Role successfully');
        await commit(conn); 
        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.error('Error during transaction rollback', rollbackError);
            }
        }
        console.error('Error while Getting Role', error);
        throw new BadRequestError('Error occurred while Getting Role');
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


const updateRoleService = async (id, body) => {  
    let conn;
            if (!body || !id) {
                throw new BadRequestError('Missing required fields: body or id');
            }
            try {
                conn = await getConnection();
                await beginTransaction(conn); // Start a transaction 
                const data = await updateRoleDao(id, body);
                console.log('Updated Role successfully', 'info');
                await commit(conn); 
                return data;
            } catch (error) {
                if (conn) {
                    try {
                        await rollback(conn); // Rollback the transaction in case of error  
                    } catch (rollbackError) {
                        console.error('Error during transaction rollback', rollbackError);
                    }
                }
                console.error('Error while Updating Role', error);
                throw new BadRequestError('Error occurred while Updating Role');
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
      
        
const deleteRoleService = async (id,userData ) => {  
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction 
        const data = await deleteRoleDao(id,userData);
        console.log('Deleted Role successfully', 'info');
        await commit(conn); 
        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error  
            } catch (rollbackError) {
                console.error('Error during transaction rollback', rollbackError);
            }
        }
        console.error('Error while Deleting Role', error);
        throw new BadRequestError('Error occurred while Deleting Role');
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



export { getRoleService,createRoleService ,updateRoleService,deleteRoleService};