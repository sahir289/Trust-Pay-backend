import { buildSelectQuery, executeQuery } from '../../utils/db.js';

const getPayInMerchantReportDao = async (merchant_id, startDate, endDate) => {
   try {
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
   } catch (error) {
      console.error('Error in getPayInMerchantReportDao:', error);
      throw error;
   }
};

const getPayInVendorReportDao = async (id, startDate, endDate) => {
   try {
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
   } catch (error) {
      console.error('Error in getPayInVendorReportDao:', error);
      throw error;
   }
}

const getPayOutMerchantReportDao = async (id, startDate, endDate) => {
   try {
      let query = `SELECT *  FROM  "Payout" WHERE 1=1`;
      const [sql, parameters] = buildSelectQuery(query, { merchant_id: id });
      if (startDate && endDate) {
         query += ` AND created_at BETWEEN $${Object.keys(parameters).length + 1} AND $${Object.keys(parameters).length + 2}`;
         parameters[`created_at_start`] = startDate;
         parameters[`created_at_end`] = endDate;
      }
      const result = await executeQuery(sql, parameters);
      console.log(result.rows[0], sql, parameters, "payinsss");
      return result.rows;
   } catch (error) {
      console.error('Error in getPayOutMerchantReportDao:', error);
      throw error;
   }
};

const getPayOutVendorReportDao = async (id, startDate, endDate) => {
   try {
      let query = `SELECT *  FROM  "Payout" WHERE 1=1`;
      const [sql, parameters] = buildSelectQuery(query, { bank_acc_id: id });
      if (startDate && endDate) {
         query += ` AND created_at BETWEEN $${Object.keys(parameters).length + 1} AND $${Object.keys(parameters).length + 2}`;
         parameters[`created_at_start`] = startDate;
         parameters[`created_at_end`] = endDate;
      }
      const result = await executeQuery(sql, parameters);
      console.log(result.rows[0], sql, parameters, "payinsss");
      return result.rows;
   } catch (error) {
      console.error('Error in getPayOutVendorReportDao:', error);
      throw error;
   }
};

const getMerchantReportDao = async (id, startDate, endDate) => {
   try {
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
   } catch (error) {
      console.error('Error in getMerchantReportDao:', error);
      throw error;
   }
};

const getVendorReportDao = async (id, startDate, endDate) => {
   try {
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
   } catch (error) {
      console.error('Error in getVendorReportDao:', error);
      throw error;
   }
};

export { getPayInMerchantReportDao, getPayInVendorReportDao, getPayOutMerchantReportDao, getPayOutVendorReportDao, getMerchantReportDao, getVendorReportDao };
