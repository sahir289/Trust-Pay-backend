import { executeQuery, buildSelectQuery, buildInsertQuery, buildUpdateQuery } from "../../utils/db.js";
import { columns,tableName } from "../../constants/index.js";

const getCalculationDao = async (id) => {
    try {
      const baseQuery = `SELECT * 
      FROM "${tableName}" 
      WHERE 1=1`;
      const [sql, queryParams] = buildSelectQuery(baseQuery, {user_id : id});
      const row = await executeQuery(sql, queryParams);
  
      return row.rows[0];
    } catch (error) {
      console.error('Error fetching Calculation', error);
      throw new sendError('Failed to fetch Calculation');
    }
  };

const createCalculationDao = async (data, conn) => {
  const [sql, params] = buildInsertQuery(tableName, data)
  if (conn && conn.query) {
    const result = await conn.query(sql, params);
    return result.rows[0];
  }
  const result = await executeQuery(sql, params);
  return result.rows[0];
}

    // if (data.chargeback_amount) {
    //   updatedData.total_chargeback_count = Number(previousData.total_chargeback_count) + 1;
    //   updatedData.total_chargeback_amount = Number(previousData.total_chargeback_amount) + Number(data.chargeback_amount);
    //   updatedData.current_balance = Number(previousData.current_balance) - Number(data.chargeback_amount);
    // }

const updateCalculationDao = async (user_id, data) => {
    const [sql, params] = buildUpdateQuery(tableName.CALCULATION, data, { user_id });
    const result = await executeQuery(sql, params);
    return result.rows[0]; 
};

const deleteCalculationDao = async (id, data) => {
  const [sql, params] = buildUpdateQuery(tableName.CALCULATION, data, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];
}


export { getCalculationDao, createCalculationDao, updateCalculationDao, deleteCalculationDao };
