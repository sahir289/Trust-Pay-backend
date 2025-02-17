import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

const tableName = 'Payin';

export const generatePayInUrlDao = async (data) => {
    const [sql, params] = buildInsertQuery(tableName, data)
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const getPayInUrlDao = async (filters) => {
    const [sql, params] = buildSelectQuery(`SELECT * FROM "${tableName}" WHERE 1=1`, filters);
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const getPayInUrlsDao = async (filters = {}) => {
    const [sql, params] = buildSelectQuery(`SELECT * FROM "${tableName}" WHERE 1=1`, filters);
    const result = await executeQuery(sql, params);
    return result.rows;
}

export const updatePayInUrlDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

