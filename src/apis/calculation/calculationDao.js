import { sendError } from "../../utils/responseHandlers.js";
import { executeQuery,buildSelectQuery,buildInsertQuery ,buildUpdateQuery } from "../../utils/db.js";
const tableName = 'Calculation';

const getCalculationDao = async (filters = {}) => {
    try {
      const baseQuery = `SELECT * 
                         FROM public."${tableName}" 
                         WHERE is_obsolete = false`;
      const [sql, queryParams] = buildSelectQuery(baseQuery, filters);
      const rows = await executeQuery(sql, queryParams);
  
      return rows.rows;
    } catch (error) {
      console.error('Error fetching Calculation', error);
      throw new sendError('Failed to fetch Calculation');
    }
  };

const createCalculationDao = async (data) => {  
    const [sql, params] = buildInsertQuery(tableName, data)
           const result = await executeQuery(sql, params);
           return result.rows[0];
  }


  const updateCalculationDao = async (id,data) => {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  }
  const deleteCalculationDao = async (id,data) => {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  }



  export {getCalculationDao,createCalculationDao ,updateCalculationDao ,deleteCalculationDao};