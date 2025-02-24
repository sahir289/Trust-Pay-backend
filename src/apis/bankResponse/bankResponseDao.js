import { tableName } from "../../constants/index.js"
import { buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js"

export const getBankResponsesDao = async (filters) => {
    const [sql, params] = buildSelectQuery(`SELECT * from ${tableName.BANK_RESPONSE} WHERE 1=1`, filters);
    return await executeQuery(sql, params);
}

export const getBankResponseDao = async (filters) => {
    const [sql, params] = buildSelectQuery(`SELECT * from "${tableName.BANK_RESPONSE}" WHERE 1=1`, filters);
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const updateBankResponseDao = async (filters, payload, conn) => {
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, payload, filters);
    if (conn && conn.query) {
        const result = await conn.query(sql, params);
        return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
}