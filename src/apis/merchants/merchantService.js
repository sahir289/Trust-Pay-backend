import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { createMerchantDao, deleteMerchantDao, getMerchantsDao, updateMerchantDao } from './merchantDao.js';
import { getRoleDao } from '../roles/rolesDao.js';
import { createUserHierarchyDao, getUserHierarchysDao, updateUserHierarchyDao } from '../userHierarchy/userHierarchyDao.js';
import { Method } from '../../constants/index.js';

// Create Merchant Service
const createMerchantService = async (payload) => {
    try {
        const parentId = payload.parentId;
        delete payload.parentId;

        const data = await createMerchantDao(payload);
        const role = await getRoleDao({ id: data.role_id });
        
        if (role.role === Method.MERCHANT) {
            await createUserHierarchyDao({
                user_id: data.user_id,
                role_id: data.role_id,
                created_by: data.created_by,
                updated_by: data.updated_by,
                company_id: data.company_id
            });
        } else if (role.role === Method.SUBMERCHANT) {
            const hierarchy = await getUserHierarchysDao(parentId);
            await updateUserHierarchyDao(hierarchy.id, {
                config: {
                    child: [...(hierarchy?.config?.child || []), data.id]  // Use spread operator to add new element
                }
            });
        }

        console.log('Merchant created successfully');
        return data;
    } catch (error) {
        console.error('Error while creating merchant', error);
        throw new BadRequestError('Error occurred while creating merchant');
    }
};

// Get Merchants Service
const getMerchantsService = async (payload) => {
    try {
        const data = await getMerchantsDao(payload);
        return data;
    } catch (error) {
        console.error('Error while fetching merchants', error);
        throw new BadRequestError('Error occurred while fetching merchants');
    }
};

// Update Merchant Service
const updateMerchantService = async (id, payload) => {
    try {
        const data = await updateMerchantDao(id, payload); // Adjust DAO call for update
        console.log('Merchant updated successfully');
        return data;
    } catch (error) {
        console.error('Error while updating merchant', error);
        throw new BadRequestError('Error occurred while updating merchant');
    }
};

// Delete Merchant Service (with Transaction Handling)
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
        console.error('Error while deleting merchant', error);
        throw new BadRequestError('Error occurred while deleting merchant');
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

export { createMerchantService, getMerchantsService, updateMerchantService, deleteMerchantService };
