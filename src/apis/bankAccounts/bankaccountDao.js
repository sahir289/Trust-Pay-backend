import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
const tableName = 'BankAccount';



const getBankaccountByIdDao = async (id) => {
const query = `SELECT *  FROM  "${tableName}" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, {id} );
   const result = await executeQuery(sql, parameters);
   return result.rows[0];
};

const createBankaccountByIdDao = async (payload ) => {
    const [sql, params] = buildInsertQuery(tableName, payload)
        const result = await executeQuery(sql, params);
        return result.rows[0];
};

const updateBankaccountByIdDao = async (id, payload) => {  
  const [sql, params] = buildUpdateQuery(tableName, payload, {id});
  const result = await executeQuery(sql, params);
  return result.rows[0];
  
};

const deleteBankaccountByIdDao = async ( id, data) => {
  const [sql, params] = buildUpdateQuery(tableName, data, {id});
  const result = await executeQuery(sql, params);
  return result.rows[0];

};


export {  getBankaccountByIdDao, createBankaccountByIdDao, updateBankaccountByIdDao, deleteBankaccountByIdDao };
