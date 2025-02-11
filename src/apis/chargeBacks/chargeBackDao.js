import { buildInsertQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

const tableName = 'Chargeback';

export const createChargeBackDao = async (data) => {
    const [sql, params] = buildInsertQuery(tableName, data)
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const getChargeBackDao = async (id) => {
    const query = `SELECT * FROM "${tableName}" WHERE id=$1`;
    const result = await executeQuery(query, [id]);
    return result.rows[0];
}

export const updateChargeBackDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}
export const deleteChargeBackDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}