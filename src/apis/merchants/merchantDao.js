import { columns, tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

export const createMerchantDao = async (data) => {
    console.log(data)
    try {
        const [sql, params] = buildInsertQuery(tableName.MERCHANT, data);
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error in createMerchantDao:', error);
        throw new Error('Failed to create merchant');
    }
};

export const getMerchantsDao = async (
    search,
    page,
    pageSize,
    sortBy,
    sortOrder
) => {
    try {
        const baseQuery = `SELECT id,role_id, user_id, first_name, last_name, code, min_payin, max_payin, payin_commission, min_payout, max_payout, payout_commission, is_test_mode, is_enabled, dispute_enabled, is_demo, balance, created_by, updated_by, created_at, updated_at FROM "${tableName.MERCHANT}" WHERE 1=1 AND "company_id"=$1 AND "user_id"=$1 AND "role_id"=$1`;
        const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.MERCHANT, page, pageSize, sortBy, sortOrder, typeof search != 'string');
        // Execute query
        const result = await executeQuery(sql, queryParams);
        return result.rows;
    } catch (error) {
        console.error('Error in getMerchantsDao:', error);
        throw new Error('Failed to fetch merchants');
    }
};

export const updateMerchantDao = async (id,company_id,role_id,user_id, data, conn) => {
    try {
        const [sql, params] = buildUpdateQuery(tableName.MERCHANT, data, { id,company_id,role_id,user_id, });
        if (conn && conn.query) {
            const result = await conn.query(sql, params);
            return result.rows[0];
        }
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error in updateMerchantDao:', error);
        throw new Error('Failed to update merchant');
    }
};

export const deleteMerchantDao = async (id,company_id,role_id,user_id, data) => {
    try {
        const [sql, params] = buildUpdateQuery(tableName.MERCHANT, data, { id,company_id,role_id,user_id});
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error in deleteMerchantDao:', error);
        throw new Error('Failed to delete merchant');
    }
};

export const updateMerchantBalanceDao = async (filters, valueToAdd, conn) => {
    try {
        const [sql, params] = buildUpdateQuery(tableName.MERCHANT, { balance: valueToAdd }, filters, { balance: '+' });
        if (conn && conn.query) {
            const result = await conn.query(sql, params);
            return result.rows[0];
        }
        const result = await executeQuery(sql, params);
        return result[0];
    } catch (error) {
        console.error('Error in updateMerchantBalanceDao:', error);
        throw new Error('Failed to update merchant balance');
    }
};
