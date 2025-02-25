import { tableName } from "../../constants/index.js";
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

export const updatePayInDao = async (id, data) => {
    
    const [sql, params] = buildUpdateQuery(tableName.PAYIN, data, { id });
    const result = await executeQuery(sql, params);
    console.log(sql, params, "queryisis")
    return result.rows[0];
}