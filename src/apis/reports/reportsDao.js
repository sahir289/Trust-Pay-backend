import { buildSelectQuery, executeQuery } from '../../utils/db.js';




const getPayInMerchantReportDao = async (merchant_id) => {
   const tableName = 'Payin';
   const query = `SELECT *  FROM  "${tableName}" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, { merchant_id: merchant_id });
   const result = await executeQuery(sql, parameters);
   return result.rows;
};

const getPayInVendorReportDao = async(id)=>{
   const tableName = 'Payin';
   const query = `SELECT *  FROM  "${tableName}" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, { bank_acc_id: id });
   const result = await executeQuery(sql, parameters);
   return result.rows;
}

const getPayOutMerchantReportDao = async (id) => {
   const query = `SELECT *  FROM  "Payout" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, { merchant_id: id });
   const result = await executeQuery(sql, parameters);
   console.log(result.rows[0], sql, parameters, "payinsss")
   return result.rows;
};

const getPayOutVendorReportDao = async (id) => {
   const query = `SELECT *  FROM  "Payout" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, { bank_acc_id: id });
   const result = await executeQuery(sql, parameters);
   console.log(result.rows[0], sql, parameters, "payinsss")
   return result.rows;
};

const getMerchantReportDao = async (id) => {
   const query = `SELECT *  FROM  "Payin" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, { merchant_id: id });
   const result = await executeQuery(sql, parameters);

   const payOutquery = `SELECT *  FROM  "Payout" WHERE 1=1`;
   const [payOutsql, payOutparameters] = buildSelectQuery(payOutquery, { merchant_id: id });
   const payOutresult = await executeQuery(payOutsql, payOutparameters);

   const combinedRows = [...result.rows, ...payOutresult.rows];
   return combinedRows;
};
const getVendorReportDao = async (id) => {
   const query = `SELECT *  FROM  "Payin" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, { bank_acc_id: id });
   const result = await executeQuery(sql, parameters);

   const payOutquery = `SELECT *  FROM  "Payout" WHERE 1=1`;
   const [payOutsql, payOutparameters] = buildSelectQuery(payOutquery, { bank_acc_id: id });
   const payOutresult = await executeQuery(payOutsql, payOutparameters);

   const combinedRows = [...result.rows, ...payOutresult.rows];
   return combinedRows;
};




export { getPayInMerchantReportDao,getPayInVendorReportDao,getPayOutMerchantReportDao ,getPayOutVendorReportDao, getMerchantReportDao, getVendorReportDao };
