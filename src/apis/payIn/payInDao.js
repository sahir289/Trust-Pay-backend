import { columns, tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

export const generatePayInUrlDao = async (data) => {
    const [sql, params] = buildInsertQuery(tableName.PAYIN, data)
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const getPayInUrlDao = async (filters) => {
    const [sql, params] = buildSelectQuery(`SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`, filters);
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const getPayInUrlsDao = async (filters = {}) => {
    const [sql, params] = buildSelectQuery(`SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`, filters);
    const result = await executeQuery(sql, params);
    return result.rows;
}

export const updatePayInUrlDao = async (id, data, conn) => {
    const [sql, params] = buildUpdateQuery(tableName.PAYIN, data, { id });
    if (conn && conn.query) {
        const result = await conn.query(sql, params);
        return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const getPayinsDao = async (
    search,
    page,
    pageSize,
    sortBy,
    sortOrder
) => {
    const baseQuery = `SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.PAYIN, page, pageSize, sortBy, sortOrder, typeof search != 'string');
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
};