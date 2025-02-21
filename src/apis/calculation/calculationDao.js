import { executeQuery, buildSelectQuery, buildInsertQuery, buildUpdateQuery } from "../../utils/db.js";
import { columns, tableName } from "../../constants/index.js";
import { sendError } from "../../utils/responseHandlers.js";

const getCalculationDao = async (search,
  page,
  pageSize,
  sortBy,
  sortOrder) => {
    try {
      const baseQuery = `SELECT * FROM "${tableName.CALCULATION}" WHERE 1=1`;
       const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.CALCULATION, page, pageSize, sortBy, sortOrder, typeof search != 'string');
       // Execute query
       const result = await executeQuery(sql, queryParams);
       return result.rows[0];
    } catch (error) {
      console.error('Error fetching Calculation', error);
      throw new sendError('Failed to fetch Calculation');
    }
  };
  
 


const createCalculationDao = async (data, conn) => {
  const [sql, params] = buildInsertQuery(tableName.CALCULATION, data)
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

const updateCalculationDao = async (conn,id, data) => {
    const [sql, params] = buildUpdateQuery(tableName.CALCULATION, data, { id });
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
  }
    const result = await executeQuery(sql, params);
    return result.rows[0]; 
};

const deleteCalculationDao = async (conn,id, data) => {
  const [sql, params] = buildUpdateQuery(tableName.CALCULATION, data, { id });
  if (conn && conn.query) {
    const result = await conn.query(sql, params);
    return result.rows[0];
}
  const result = await executeQuery(sql, params);
  return result.rows[0];
}

export const updateCalculationBalanceDao = async (filters, data, conn) => {
  const specialFields = {};
  Object.keys(data).forEach(el => {
    specialFields[el] = "+";
  })
  const [sql, params] = buildUpdateQuery(tableName, data, filters, specialFields);
  if (conn && conn.query) {
    const result = await conn.query(sql, params);
    return result.rows[0];
  }
  const result = await executeQuery(sql, params);
  return result[0];
}


export { getCalculationDao, createCalculationDao, updateCalculationDao, deleteCalculationDao };
