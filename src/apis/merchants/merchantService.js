import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { createMerchantDao, deleteMerchantDao, getMerchantsDao, updateMerchantDao } from './merchantDao.js';
import { getRoleDao } from '../roles/rolesDao.js';
import { createUserHierarchyDao, getUserHierarchysDao, updateUserHierarchyDao } from '../userHierarchy/userHierarchyDao.js';
import { merchantColumns, Method, Role } from '../../constants/index.js';

// Create Merchant Service
const createMerchantService = async (payload) => {
    try {
        const filterColumns = merchantColumns.MERCHANT;
        const parentId = payload.parentId;
        delete payload.parentId;

        const data = await createMerchantDao(payload);
        const role = await getRoleDao({ id: payload.role_id });
        
        if (role.role === Method.MERCHANT) {
            await createUserHierarchyDao({
                user_id: payload.user_id,
                role_id: payload.role_id,
                created_by: payload.created_by,
                updated_by: payload.updated_by,
                company_id: payload.company_id
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
        const finalResult = await filterResponse(data, filterColumns);
        return finalResult;
    } catch (error) {
        console.error('Error while creating merchant', error);
        throw new BadRequestError('Error occurred while creating merchant');
    }
};

// Get Merchants Service
const getMerchantsService = async (search,user) => {
    try {
        const filterColumns = merchantColumns.MERCHANT;
        const data = await getMerchantsDao(search,user);
        const finalResult = await filterResponse(data, filterColumns);
        return finalResult;
    } catch (error) {
        console.error('Error while fetching merchants', error);
        throw new BadRequestError('Error occurred while fetching merchants');
    }
};

// Update Merchant Service
const updateMerchantService = async (id,company_id,role_id,user_id, payload) => {
    try {
        const filterColumns = merchantColumns.MERCHANT;
        const data = await updateMerchantDao(id,company_id,role_id,user_id, payload); // Adjust DAO call for update
        console.log('Merchant updated successfully');
        const finalResult = await filterResponse(data, filterColumns);
        return finalResult;
    } catch (error) {
        console.error('Error while updating merchant', error);
        throw new BadRequestError('Error occurred while updating merchant');
    }
};

// Delete Merchant Service (with Transaction Handling)
const deleteMerchantService = async (id,company_id,role_id,user_id) => {
    let conn;
    try {
        const filterColumns = merchantColumns.MERCHANT;
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction

        const payload = { is_obsolete: true };
        const data = await deleteMerchantDao(id,company_id,role_id,user_id, payload); // Adjust DAO call for delete

        await commit(conn); // Commit the transaction
        console.log('Merchant deleted successfully');
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
