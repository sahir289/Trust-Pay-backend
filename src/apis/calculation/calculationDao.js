import { sendError } from "../../utils/responseHandlers.js";
import { executeQuery,buildSelectQuery,buildInsertQuery ,buildUpdateQuery } from "../../utils/db.js";
const tableName = 'Calculation';

const getCalculationDao = async (filters={}) => {
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

const updateCalculationDao = async (id, data) => {
  try {
    // Fetch the latest calculation data for the user
    const getLatestCalculationSql = `
      SELECT * FROM "Calculation"
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    
    const latestCalculationResult = await executeQuery(getLatestCalculationSql, [id]);
    if (!latestCalculationResult.rows.length) {
      throw new Error('No previous calculation found for this user');
    }

    const previousData = latestCalculationResult.rows[0]; 
    
    let updatedData = {}; 


    if (data.payin_amount) {
      updatedData.total_payin_count = Number(previousData.total_payin_count) + 1;
      updatedData.total_payin_amount = Number(previousData.total_payin_amount) + Number(data.payin_amount);
      updatedData.total_payin_commission = (updatedData.total_payin_amount * 3) / 100;
      updatedData.current_balance = Number(previousData.current_balance) + (Number(data.payin_amount) - (Number(data.payin_amount) * 3 / 100));
    }
    
    if (data.payout_amount) {
      updatedData.total_payout_count = Number(previousData.total_payout_count) + 1;
      updatedData.total_payout_amount = Number(previousData.total_payout_amount) + Number(data.payout_amount);
      updatedData.total_payout_commission = (updatedData.total_payout_amount * 3) / 100;
      updatedData.current_balance = Number(previousData.current_balance) - (Number(data.payout_amount) - (Number(data.payout_amount) * 3 / 100));
    }

    if (data.reversed_amount) {
      updatedData.total_payout_amount = Number(previousData.total_payout_amount) - Number(data.reversed_amount);
      updatedData.current_balance = Number(previousData.current_balance) + (Number(data.reversed_amount) - (Number(data.reversed_amount) * 3 / 100));
    }

    if (data.settlement_amount) {
      updatedData.total_settlement_count = Number(previousData.total_settlement_count) + 1;
      updatedData.total_settlement_amount = Number(previousData.total_settlement_amount) + Number(data.settlement_amount);
      updatedData.current_balance = Number(previousData.current_balance) - Number(data.settlement_amount);
    }

    if (data.chargeback_amount) {
      updatedData.total_chargeback_count = Number(previousData.total_chargeback_count) + 1;
      updatedData.total_chargeback_amount = Number(previousData.total_chargeback_amount) + Number(data.chargeback_amount);
      updatedData.current_balance = Number(previousData.current_balance) - Number(data.chargeback_amount);
    }

    // updatedData.updated_at = new Date(); 

    delete updatedData.created_at;

    const [sql, params] = buildUpdateQuery("Calculation", updatedData, { user_id: id });

    const result = await executeQuery(sql, params);

    return result.rows[0]; 
  } catch (error) {
    console.error("Error updating calculation", error);
    throw new Error("Failed to update calculation");
  }
};




const deleteCalculationDao = async (id,data) => {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  }

export {getCalculationDao,createCalculationDao ,updateCalculationDao ,deleteCalculationDao};