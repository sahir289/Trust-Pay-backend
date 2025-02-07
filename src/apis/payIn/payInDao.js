import { buildInsertQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

const tableName = 'Payin';

export const generatePayInUrlDao = async (data)=>{
    const [sql, params] = buildInsertQuery(tableName, data)
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const validatePayInUrlDao = async (id)=>{
    const query = `SELECT * FROM "${tableName}" WHERE id=$1`;
    const result = await executeQuery(query, [id]);
    return result.rows[0];
}

export const updatePayInUrlDao = async (id, data)=>{
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    console.log(result.rows);
    return result.rows[0];
}