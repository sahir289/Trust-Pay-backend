import { tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";
import { buildSearchFilterObj } from "../../utils/searchBuilder.js";

export const createVendorDao = async (data,conn) => {
    try {
        const [sql, params] = buildInsertQuery(tableName.VENDOR, data);
        if (conn && conn.query) {
            const result = await conn.query(sql, params);
            return result.rows[0];
        }
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
    sortOrder,
    columns = [],
) => {
    try {

        const baseQuery = `SELECT ${columns.length ? columns.join(', ') : "*"} FROM "${tableName.VENDOR}" WHERE 1=1`;

        // Execute query
         if (filters.search) {
                    filters.or = buildSearchFilterObj(filters.search, tableName.VENDOR);
                    delete filters.search;
                }
                const [sql, queryParams] = buildSelectQuery(baseQuery, filters, page, pageSize, sortBy, sortOrder);

        const result = await executeQuery(sql, queryParams);
        return result.rows;
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
