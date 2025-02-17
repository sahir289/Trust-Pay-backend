import { tableName } from "../../constants/index.js"
import { buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js"

export const getBankResponsesDao = async (filters)=>{
    const [sql, params] = buildSelectQuery(`SELECT * from ${tableName.BANK_RESPONSE}`, filters);
    return await executeQuery(sql, params);    
}

export const updateBankResponseDao = async (filters, payload)=>{
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, payload, filters);
    const result = await executeQuery(sql, params);
    return result.rows[0];
}