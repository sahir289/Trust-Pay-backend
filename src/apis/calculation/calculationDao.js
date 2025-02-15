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

   
const createCalculationDao = async (data) => {
  const [sql, params] = buildInsertQuery(tableName.CALCULATION, data)
  const result = await executeQuery(sql, params);
  return result.rows[0];
}


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
