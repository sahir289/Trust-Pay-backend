import { buildSelectQuery, executeQuery } from "../../utils/db.js";

const tableName = 'Payout';

export const getWithDrawByIdDao = async (id) => {
    const query = `SELECT * FROM  "${tableName}" WHERE 1=1`;
    const [sql, parameters] = buildSelectQuery(query, { id });
    const result = await executeQuery(sql, parameters);
    return result.rows;
}


