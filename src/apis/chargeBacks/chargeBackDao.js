import { columns, tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

export const createChargeBackDao = async (data) => {
    const [sql, params] = buildInsertQuery(tableName.CHAREBACK, data)
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const getChargeBackDao = async (
    search,
    page,
    pageSize,
    sortBy,
    sortOrder
) => {
    const baseQuery = `SELECT * FROM "${tableName.CHAREBACK}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.CHAREBACK, page, pageSize, sortBy, sortOrder, typeof search != 'string');
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
};


export const updateChargeBackDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName.CHAREBACK, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}
export const deleteChargeBackDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName.CHAREBACK, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}