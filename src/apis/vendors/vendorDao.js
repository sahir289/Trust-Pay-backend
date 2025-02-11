import { buildInsertQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

const tableName = 'Vendor';

export const createVendorDao = async (data) => {
    const [sql, params] = buildInsertQuery(tableName, data)
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const getVendorsDao = async () => {
    const query = `SELECT * FROM "${tableName}"`;
    const result = await executeQuery(query);
    return result.rows[0];
}

export const updateVendorDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}
export const deleteVendorDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}