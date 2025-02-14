import { columns, tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

export const createVendorDao = async (data) => {
    const [sql, params] = buildInsertQuery(tableName.VENDOR, data)
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const getVendorsDao = async (
    search,
    page,
    pageSize,
    sortBy,
    sortOrder
) => {
    const baseQuery = `SELECT * FROM "${tableName.VENDOR}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.VENDOR, page, pageSize, sortBy, sortOrder, typeof search != 'string');
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
};


export const updateVendorDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}
export const deleteVendorDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}