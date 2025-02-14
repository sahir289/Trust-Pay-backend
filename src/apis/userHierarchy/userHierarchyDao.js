import { columns, tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

export const createUserHierarchyDao = async (data) => {
    const [sql, params] = buildInsertQuery(tableName.USER_HIERARCHY, data)
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const getUserHierarchysDao = async (
    search,
    page,
    pageSize,
    sortBy,
    sortOrder
) => {
    const baseQuery = `SELECT * FROM "${tableName.USER_HIERARCHY}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.USER_HIERARCHY, page, pageSize, sortBy, sortOrder, typeof search != 'string');
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
};


export const updateUserHierarchyDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName.USER_HIERARCHY, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}
export const deleteUserHierarchyDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName.USER_HIERARCHY, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}