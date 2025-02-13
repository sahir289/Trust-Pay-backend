import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { createMerchantDao, deleteMerchantDao, getMerchantsDao, updateMerchantDao } from './merchantDao.js';
import { getRoleDao } from '../roles/rolesDao.js';
import { createUserHierarchyDao, getUserHierarchysDao, updateUserHierarchyDao } from '../userHierarchy/userHierarchyDao.js';
import { Method } from '../../constants/index.js';


const createMerchantService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction
        const parentId = payload.parentId;
        delete payload.parentId;

        const data = await createMerchantDao(payload);

        const role = await getRoleDao({ id: data.role_id});
        if (role.role === Method.MERCHANT) {
            await createUserHierarchyDao({
                user_id: data.id,
                role_id: data.role_id,
            })
        }
        else if (role.role === Method.SUBMERCHANT) {
            const hierarchy = await getUserHierarchysDao(parentId);
            await updateUserHierarchyDao(hierarchy.id, { 
                config: { 
                    child: [...(hierarchy?.config?.child || []), data.id]  // Use spread operator to add new element
                } 
            });
        }

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

const getMerchantsService = async (payload) => {
    let conn;
    try {
        
        conn = await getConnection();
        await beginTransaction(conn);
        const data = await getMerchantsDao(payload);
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
