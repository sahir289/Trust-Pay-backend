import { buildSelectQuery, executeQuery } from '../../utils/db.js';




const getPayInMerchantReportDao = async (merchant_id, startDate, endDate) => {
   const tableName = 'Payin';
   let query = `SELECT *  FROM  "${tableName}" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, { merchant_id: merchant_id });
   if (startDate && endDate) {
      query += ` AND created_at BETWEEN $${Object.keys(parameters).length + 1} AND $${Object.keys(parameters).length + 2}`;
      parameters[`created_at_start`] = startDate;
      parameters[`created_at_end`] = endDate;
   }
   const result = await executeQuery(sql, parameters);
   return result.rows;
};

const getPayInVendorReportDao = async(id, startDate, endDate)=>{
   const tableName = 'Payin';
   let query = `SELECT *  FROM  "${tableName}" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, { bank_acc_id: id });
   if (startDate && endDate) {
      query += ` AND created_at BETWEEN $${Object.keys(parameters).length + 1} AND $${Object.keys(parameters).length + 2}`;
      parameters[`created_at_start`] = startDate;
      parameters[`created_at_end`] = endDate;
   }
   const result = await executeQuery(sql, parameters);
   return result.rows;
}

const getPayOutMerchantReportDao = async (id, startDate, endDate) => {
   let query = `SELECT *  FROM  "Payout" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, { merchant_id: id });
   if (startDate && endDate) {
      query += ` AND created_at BETWEEN $${Object.keys(parameters).length + 1} AND $${Object.keys(parameters).length + 2}`;
      parameters[`created_at_start`] = startDate;
      parameters[`created_at_end`] = endDate;
   }
   const result = await executeQuery(sql, parameters);
   console.log(result.rows[0], sql, parameters, "payinsss")
   return result.rows;
};

const getPayOutVendorReportDao = async (id, startDate, endDate) => {
   let query = `SELECT *  FROM  "Payout" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, { bank_acc_id: id });
   if (startDate && endDate) {
      query += ` AND created_at BETWEEN $${Object.keys(parameters).length + 1} AND $${Object.keys(parameters).length + 2}`;
      parameters[`created_at_start`] = startDate;
      parameters[`created_at_end`] = endDate;
   }
   const result = await executeQuery(sql, parameters);
   console.log(result.rows[0], sql, parameters, "payinsss")
   return result.rows;
};

const getMerchantReportDao = async (id, startDate, endDate) => {
   let query = `SELECT *  FROM  "Payin" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, { merchant_id: id });
   if (startDate && endDate) {
      query += ` AND created_at BETWEEN $${Object.keys(parameters).length + 1} AND $${Object.keys(parameters).length + 2}`;
      parameters[`created_at_start`] = startDate;
      parameters[`created_at_end`] = endDate;
   }
   const result = await executeQuery(sql, parameters);

   const payOutquery = `SELECT *  FROM  "Payout" WHERE 1=1`;
   const [payOutsql, payOutparameters] = buildSelectQuery(payOutquery, { merchant_id: id });
   if (startDate && endDate) {
      query += ` AND created_at BETWEEN $${Object.keys(parameters).length + 1} AND $${Object.keys(parameters).length + 2}`;
      parameters[`created_at_start`] = startDate;
      parameters[`created_at_end`] = endDate;
   }
   const payOutresult = await executeQuery(payOutsql, payOutparameters);

   const combinedRows = [...result.rows, ...payOutresult.rows];
   return combinedRows;
};
const getVendorReportDao = async (id, startDate, endDate) => {
   let query = `SELECT *  FROM  "Payin" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, { bank_acc_id: id });
   if (startDate && endDate) {
      query += ` AND created_at BETWEEN $${Object.keys(parameters).length + 1} AND $${Object.keys(parameters).length + 2}`;
      parameters[`created_at_start`] = startDate;
      parameters[`created_at_end`] = endDate;
   }
   const result = await executeQuery(sql, parameters);

   let payOutquery = `SELECT *  FROM  "Payout" WHERE 1=1`;
   const [payOutsql, payOutparameters] = buildSelectQuery(payOutquery, { bank_acc_id: id });
   if (startDate && endDate) {
      query += ` AND created_at BETWEEN $${Object.keys(parameters).length + 1} AND $${Object.keys(parameters).length + 2}`;
      parameters[`created_at_start`] = startDate;
      parameters[`created_at_end`] = endDate;
   }
   const payOutresult = await executeQuery(payOutsql, payOutparameters);

   const combinedRows = [...result.rows, ...payOutresult.rows];
   return combinedRows;
};




export { getPayInMerchantReportDao,getPayInVendorReportDao,getPayOutMerchantReportDao ,getPayOutVendorReportDao, getMerchantReportDao, getVendorReportDao };
