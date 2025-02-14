import { columns, tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildSelectStringQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";


export const createMerchantDao = async (data) => {
    const [sql, params] = buildInsertQuery(tableName.MERCHANT, data)
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const getMerchantsDao = async ({
    searchString = null,
    searchJson = null,
    page = 1,
    pageSize = 10,
    sortBy = "created_at",
    sortOrder = "DESC"
} = {}) => {
    let baseQuery = `SELECT * FROM "${tableName.MERCHANT}"`;
    let sql = '';
    let queryParams = [];
    // let json = {}

    if (searchString) {
        // const columns = columns.MERCHANT
        // Handle search using String columns
        [sql, queryParams] = buildSelectStringQuery(baseQuery, searchString, columns.MERCHANT, page, pageSize, sortBy, sortOrder);
    }
    else if (searchJson) {
        // Handle search using JSON columns
        [sql, queryParams] = buildSelectQuery(baseQuery, searchJson, columns.MERCHANT, page, pageSize, sortBy, sortOrder);
    }

    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
};

export const updateMerchantDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName.MERCHANT, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}
export const deleteMerchantDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName.MERCHANT, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}