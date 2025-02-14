import { columns, tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

export const createPayoutDao = async (data) => {
    const [sql, params] = buildInsertQuery(tableName.PAYOUT, data)
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const getPayoutsDao = async (
    search,
    page,
    pageSize,
    sortBy,
    sortOrder
) => {
    const baseQuery = `SELECT * FROM "${tableName.PAYOUT}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.PAYOUT, page, pageSize, sortBy, sortOrder, typeof search != 'string');
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
};

export const updatePayoutDao = async (id, data, conn) => {
    const [sql, params] = buildUpdateQuery(tableName.PAYOUT, data, { id });
    if (conn && conn.query) {
        const result = await conn.query(sql, params);
        return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const deletePayoutDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName.PAYOUT, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}