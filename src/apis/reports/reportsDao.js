import { DbError } from '../../utils/appErrors.js';
import Logger from '../../utils/logger.js';

const logger = new Logger();

const getAllPayoutDao = async (conn, { Code, status, startDate, endDate, method, isMerchant }) => {
  let sql;
  // console.log()
  if (isMerchant) {
    sql = `
      SELECT * 
      FROM Public."Payout"
      WHERE 
          (user_id LIKE ANY($1))
          AND (status = $2)
          AND (method = $3)
          AND (start_date >= $4)
          AND (end_date <= $5);
    `;
  } else {
    sql = `
      SELECT * 
      FROM public."Payout"
      JOIN public."Vendor" ON "Vendor".user_id = "Payout".user_id
      WHERE 
          "Vendor".code = $1
          AND (status = $2)
          AND (method = $3)
          AND (start_date >= $4)
          AND (end_date <= $5);
    `;
  }

  const values = [
    Code || null,  
    status || null,      
    method || null,      
    startDate || null,   
    endDate || null      
  ];

  try {
    const result = await conn.query(sql, values);
    logger.log(result, "result for query");
    return result;
  } catch (error) {
    logger.error('Error executing getAllPayoutDao query:', error);
    throw new DbError('Database query failed while fetching payout data.');
  }
};


const getAllVendorAccountReportDao = async (conn, { id, startDate, endDate }) => {
  // console.log('getAllVendorAccountReportDao');
  // console.log({ id, startDate, endDate }, "IDs from request");
  const dateFilter = [];
  if (startDate) {
    dateFilter.push(`"Vendor"."created_at" >= $2`);
  }
  if (endDate) {
    dateFilter.push(`"Vendor"."created_at" <= $3`);
  }

  const sql = `
   WITH Accounts AS (
                SELECT * 
                FROM public."Vendor" 
                LEFT JOIN public."Calculation" 
                ON "Vendor".user_id = "Calculation".user_id
                WHERE "Vendor".code = $1
                ${dateFilter.length ? `AND ${dateFilter.join(' AND ')}` : ''}
            )
            SELECT 
                total_payin_count,
                total_payin_amount,
                total_payin_commission,
                total_payout_count,
                total_payout_amount,
                total_payout_commission,
                total_settlement_count,
                total_settlement_amount,
                current_balance,
                net_balance,
                total_chargeback_amount,
                total_chargeback_count
            FROM Accounts;
  `;

  const values = [id];
  if (startDate) values.push(startDate);
  if (endDate) values.push(endDate);

  try {
      const result = await conn.query(sql, values);
      // console.log(result);
      return result.rows;
  } catch (error) {
      logger.error('Error executing getAllVendorAccountReportDao query:', error);
      throw new Error('Database query failed while fetching vendor report data.');
  }
};




export  {getAllPayoutDao,getAllVendorAccountReportDao};
