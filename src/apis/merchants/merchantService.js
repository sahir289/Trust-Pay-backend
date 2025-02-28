import {
    BadRequestError,
} from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { createMerchantDao, deleteMerchantDao, getMerchantsDao, updateMerchantDao } from './merchantDao.js';
import { getRoleDao } from '../roles/rolesDao.js';
import { createUserHierarchyDao, getUserHierarchysDao, updateUserHierarchyDao } from '../userHierarchy/userHierarchyDao.js';
import { columns, merchantColumns, Method, Role } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import { transactionWrapper } from '../../utils/db.js';
import { createCalculationDao } from '../calculation/calculationDao.js';
// Create Merchant Service
const createMerchantService = async (payload, roleIs) => {
    try {
        const filterColumns = roleIs === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;
        const parentId = payload.parentId;
        delete payload.parentId;
        const data = await createMerchantDao(payload);
        const calculationPayload={
            role_id:data.role_id,
            user_id:data.user_id,
            total_payin_count: "0",
            total_payin_amount: "0",
            total_payin_commission: "0",
            total_payout_count: "0",
            total_payout_amount: "0",
            total_payout_commission: "0",
            total_settlement_count: "0",
            total_settlement_amount: "0",
            total_chargeback_count: "0",
            total_chargeback_amount: "0",
            current_balance: "0",
            net_balance: "0",
            company_id:data.company_id
              }
     await transactionWrapper(createCalculationDao)(calculationPayload);
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
            const hierarchy = await getUserHierarchysDao({ user_id: parentId });
            await updateUserHierarchyDao(hierarchy.id, {
                config: {
                    child: [...(hierarchy?.config?.child || []), data.id]  // Use spread operator to add new element
                }
            });
        }

        console.log('Merchant created successfully');
        const finalResult = filterResponse(data, filterColumns);
        return finalResult;
    } catch (error) {
        console.error('Error while creating merchant', error);
        throw new BadRequestError('Error occurred while creating merchant');
    }
};

// Get Merchants Service
const getMerchantsService = async (filters, role) => {
    try {
        const filterColumns = role === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;
        return await getMerchantsDao(filters, null, null, null, null, filterColumns);
    } catch (error) {
        console.error('Error while fetching merchants', error);
        throw new BadRequestError('Error occurred while fetching merchants');
    }
};


// Update Merchant Service
const updateMerchantService = async (ids, payload, role) => {
    try {
        const filterColumns = role === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;
        const data = await updateMerchantDao(ids, payload); // Adjust DAO call for update
        console.log('Merchant updated successfully');
        const finalResult = filterResponse(data, filterColumns);
        return finalResult;
    } catch (error) {
        console.error('Error while updating merchant', error);
        throw new BadRequestError('Error occurred while updating merchant');
    }
};

// Delete Merchant Service (with Transaction Handling)
const deleteMerchantService = async (ids,updated_by,roleIs) => {
    let conn;
    try {
        const filterColumns = roleIs === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction

        const payload = { is_obsolete: true ,updated_by};
        const data = await deleteMerchantDao(ids, payload); // Adjust DAO call for delete
        await commit(conn); // Commit the transaction
        console.log('Merchant deleted successfully');
        const finalResult = filterResponse(data, filterColumns);
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
