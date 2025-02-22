import { columns, tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

export const createUserHierarchyDao = async (data) => {
    try {
        const [sql, params] = buildInsertQuery(tableName.USER_HIERARCHY, data);
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error in createUserHierarchyDao:', error);
        throw new Error('Failed to create user hierarchy');
    }
};

export const getUserHierarchysDao = async (
    search,
    user,
    page,
    pageSize,
    sortBy,
    sortOrder
) => {
    const baseQuery = `SELECT id  FROM "${tableName.USER_HIERARCHY}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.USER_HIERARCHY, page, pageSize, sortBy, sortOrder, typeof search != 'string',user);
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
};


export const updateUserHierarchyDao = async (id, company_id, user_id, role_id, data) => {
    try {
        const [sql, params] = buildUpdateQuery(tableName.USER_HIERARCHY, data, { id, company_id, user_id, role_id });
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error in updateUserHierarchyDao:', error);
        throw new Error('Failed to update user hierarchy');
    }
};

export const deleteUserHierarchyDao = async (id, company_id, user_id, role_id, data) => {
    try {
        const [sql, params] = buildUpdateQuery(tableName.USER_HIERARCHY, data, { id, company_id, user_id, role_id });
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error in deleteUserHierarchyDao:', error);
        throw new Error('Failed to delete user hierarchy');
    }
};
