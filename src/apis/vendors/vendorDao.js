import { columns, tableName } from "../../constants/index.js";
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
    search,payload,
    page,
    pageSize,
    sortBy,
    sortOrder
) => {
    const baseQuery = `SELECT id, first_name, last_name, code, payin_commission, payout_commission, balance, created_by, updated_by, config,  created_at, updated_at FROM "${tableName.VENDOR}" WHERE 1=1 ` ;
    const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.VENDOR, page, pageSize, sortBy, sortOrder, typeof search != 'string',payload);
    // Execute queryy
    const result = await executeQuery(sql, queryParams);
    return result.rows[0];
};


export const updateVendorDao = async (id,company_id, data, conn) => {
    const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, {id ,company_id});
    if (conn && conn.query) {
        const result = await conn.query(sql, params);
        return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
}
export const deleteVendorDao = async (id,company_id,data) => {
    const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, {id ,company_id});
    const result = await executeQuery(sql, params);
    return result.rows[0];
}


export const updateVendorBalanceDao = async (filters, valueToAdd, conn) => {
    const [sql, params] = buildUpdateQuery(tableName.VENDOR, { balance: valueToAdd }, filters, { balance: '+' });
    if (conn && conn.query) {
        const result = await conn.query(sql, params);
        return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result[0];
}
