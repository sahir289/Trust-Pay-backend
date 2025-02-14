import { columns, tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";


export const createMerchantDao = async (data) => {
    const [sql, params] = buildInsertQuery(tableName.MERCHANT, data)
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const getMerchantsDao = async (
    search,
    page,
    pageSize,
    sortBy,
    sortOrder
) => {
    const baseQuery = `SELECT * FROM "${tableName.MERCHANT}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.MERCHANT, page, pageSize, sortBy, sortOrder, typeof search != 'string');
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
};

export const updateMerchantDao = async (id, data, conn) => {
    const [sql, params] = buildUpdateQuery(tableName.MERCHANT, data, { id });
    if (conn && conn.query) {
        const result = await conn.query(sql, params);
        return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
}
export const deleteMerchantDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName.MERCHANT, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}
