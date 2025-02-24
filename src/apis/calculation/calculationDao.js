import { executeQuery, buildSelectQuery, buildInsertQuery, buildUpdateQuery } from "../../utils/db.js";
import { columns, tableName } from "../../constants/index.js";
import { sendError } from "../../utils/responseHandlers.js";

const getCalculationDao = async (search,payload,
  page,
  pageSize,
  sortBy,
  sortOrder) => {
    try {
      const baseQuery = `SELECT  "id","total_payin_count","total_payin_amount","total_payin_commission","total_payout_count","total_payout_amount","total_payout_commission","total_settlement_count","total_settlement_amount","total_chargeback_count", "total_chargeback_amount","current_balance","net_balance" FROM "${tableName.CALCULATION}" WHERE 1=1`;
       const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.CALCULATION, page, pageSize, sortBy, sortOrder, typeof search != 'string',payload);
       // Execute query
       const result = await executeQuery(sql, queryParams);
       return result.rows[0];
    } catch (error) {
      console.error('Error fetching Calculation', error);
      throw new sendError('Failed to fetch Calculation');
    }
  };
  

  const createCalculationDao = async (conn, data) => {
    try {
      const [sql, params] = buildInsertQuery(tableName.CALCULATION, data);
      
      let result;
      if (conn && conn.query) {
        result = await conn.query(sql, params); 
      } else {
        result = await executeQuery(sql, params);  
      }
  
      return result.rows ? result.rows[0] : result[0];  // Return the first row or result based on the structure
    } catch (error) {
      console.error('Error creating calculation:', error);  // Log the error for debugging
    }
  };
  
    // if (data.chargeback_amount) {
    //   updatedData.total_chargeback_count = Number(previousData.total_chargeback_count) + 1;
    //   updatedData.total_chargeback_amount = Number(previousData.total_chargeback_amount) + Number(data.chargeback_amount);
    //   updatedData.current_balance = Number(previousData.current_balance) - Number(data.chargeback_amount);
    // }
    const updateCalculationDao = async (conn, id, data) => {
      try {
        const [sql, params] = buildUpdateQuery(tableName.CALCULATION, data, id);
        
        let result;
        if (conn && conn.query) {
          result = await conn.query(sql, params);  // Use connection to execute query
        } else {
          result = await executeQuery(sql, params);  // Use executeQuery if no connection
        }
    
        return result.rows ? result.rows[0] : result[0];  // Return the first row or result based on the structure
      } catch (error) {
        console.error('Error updating calculation:', error);  // Log the error for debugging
      }
    };
    

const deleteCalculationDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CALCULATION, data, id);
    
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params);  // Use connection to execute query
    } else {
      result = await executeQuery(sql, params);  // Use executeQuery if no connection
    }

    return result.rows ? result.rows[0] : result[0];  // Return the first row or result based on the structure
  } catch (error) {
    console.error('Error deleting calculation:', error);
  }
};


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
