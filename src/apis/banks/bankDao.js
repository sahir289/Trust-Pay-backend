import { buildSelectQuery, executeQuery } from "../../utils/db.js";
const tableName = "BankAccount"
export const getMerchantBankByIdDao = async (user_id) => {
   const query = `SELECT * FROM  "${tableName}" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, { user_id });
   const result = await executeQuery(sql, parameters);
   return result.rows;
}