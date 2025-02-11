import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
const tableName = 'BankAccount';



const getBankaccountByIdDao = async (id) => {
const query = `SELECT id, sno, user_id, upi_id, upi_params, name, ac_no,
ac_name, ifsc, bank_name, is_qr, is_bank, min_payin, max_payin, is_enabled, 
payin_count, balance, today_balance, bank_used_for, config, updated_by, created_at, 
updated_at, company_id, is_obsolete  FROM  "${tableName}" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, {id} );
   const result = await executeQuery(sql, parameters);
   return result.rows[0];
};

const createBankaccountByIdDao = async (payload ) => {
    const [sql, params] = buildInsertQuery(tableName, payload)
        const result = await executeQuery(sql, params);
        return result.rows[0];

  
};

const updateBankaccountByIdDao = async (id, data) => {
   
  const [sql, params] = buildUpdateQuery(tableName, data, {id});
  const result = await executeQuery(sql, params);
  return result.rows[0];
  
};



const deleteBankaccountByIdDao = async ( id, data) => {
  const [sql, params] = buildUpdateQuery(tableName, data, {id});
  const result = await executeQuery(sql, params);
  return result.rows[0];

  
};


export {  getBankaccountByIdDao, createBankaccountByIdDao, updateBankaccountByIdDao, deleteBankaccountByIdDao };
