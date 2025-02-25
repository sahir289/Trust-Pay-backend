import { tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

export const createVendorDao = async (data) => {
    try {
        const [sql, params] = buildInsertQuery(tableName.VENDOR, data);
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error in createVendorDao:', error);
        throw new Error('Failed to create vendor');
    }
};

export const getVendorsDao = async (
    filters,
    page,
    pageSize,
    sortBy,
    sortOrder
) => {
    try {
        const baseQuery = `SELECT id, first_name, last_name, code, payin_commission, payout_commission, balance, created_by, updated_by, config, created_at, updated_at FROM "${tableName.VENDOR}" WHERE 1=1`;
        const [sql, queryParams] = buildSelectQuery(baseQuery, filters, page, pageSize, sortBy, sortOrder);
        // Execute query
        const result = await executeQuery(sql, queryParams);
        return result.rows[0];
    } catch (error) {
        console.error('Error in getVendorsDao:', error);
        throw new Error('Failed to get vendors');
    }
};

export const updateVendorDao = async (id, data, conn) => {
    try {
        const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, id);
        if (conn && conn.query) {
            const result = await conn.query(sql, params);
            return result.rows[0];
        }
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error in updateVendorDao:', error);
        throw new Error('Failed to update vendor');
    }
};

export const deleteVendorDao = async (id, data) => {
    try {
        const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, id);
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error in deleteVendorDao:', error);
        throw new Error('Failed to delete vendor');
    }
};

export const updateVendorBalanceDao = async (filters, valueToAdd, conn) => {
    try {
        const [sql, params] = buildUpdateQuery(tableName.VENDOR, { balance: valueToAdd }, filters, { balance: '+' });
        if (conn && conn.query) {
            const result = await conn.query(sql, params);
            return result.rows[0];
        }
        const result = await executeQuery(sql, params);
        return result[0];
    } catch (error) {
        console.error('Error in updateVendorBalanceDao:', error);
        throw new Error('Failed to update vendor balance');
    }
};
