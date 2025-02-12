import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
const tableName = 'Settlement';



const getSettlementByIdDao = async (id) => {
const query = `SELECT *  FROM  "${tableName}" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, {id} );
   const result = await executeQuery(sql, parameters);
   return result.rows[0];
};

const createSettlementByIdDao = async (payload ) => {
    const [sql, params] = buildInsertQuery(tableName, payload)
        const result = await executeQuery(sql, params);
        return result.rows[0];

  
};

const updateSettlementByIdDao = async (id, data) => {
   
  const [sql, params] = buildUpdateQuery(tableName, data, {id});
  const result = await executeQuery(sql, params);
  return result.rows[0];
  
};



const deleteSettlementByIdDao = async ( id, data) => {
  const [sql, params] = buildUpdateQuery(tableName, data, {id});
  const result = await executeQuery(sql, params);
  return result.rows[0];

  
};


export {  getSettlementByIdDao, createSettlementByIdDao, updateSettlementByIdDao, deleteSettlementByIdDao };
