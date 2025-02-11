import { buildSelectQuery, executeQuery } from "../../utils/db.js";

const tableName = 'Payout';

export const getWithDrawByIdDao = async (payInId) => {
    const query = `SELECT * FROM  "${tableName}" WHERE 1=1`;
    const [sql, parameters] = buildSelectQuery(query, { payInId });
    const result = await executeQuery(sql, parameters);
    return result.rows;
}


