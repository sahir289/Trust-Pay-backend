import { tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";
import { buildSearchFilterObj } from "../../utils/searchBuilder.js";

export const createMerchantDao = async (data) => {
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
    filters,
    page,
    pageSize,
    sortBy,
    sortOrder,
    // columns to select from db (optional)
    columns = [],
) => {
    try {
        const baseQuery = `SELECT ${columns.length ? columns.join(', ') : "*"} FROM "${tableName.MERCHANT}" WHERE 1=1`;
        if (filters.search) {
            filters.or = buildSearchFilterObj(filters.search, tableName.MERCHANT);
            delete filters.search;
        }
        // console.log(JSON.stringify(filters, undefined, 4));
        const [sql, queryParams] = buildSelectQuery(baseQuery, filters, page, pageSize, sortBy, sortOrder);
        // Execute query
        const result = await executeQuery(sql, queryParams);
        return result.rows;
    } catch (error) {
        console.error('Error in getMerchantsDao:', error);
        throw new Error('Failed to fetch merchants');
    }
};

export const updateMerchantDao = async (ids, data, conn) => {
    try {
        const [sql, params] = buildUpdateQuery(tableName.MERCHANT, data, ids);
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

export const deleteMerchantDao = async (ids, data) => {
    try {
        const [sql, params] = buildUpdateQuery(tableName.MERCHANT, data, ids);
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
