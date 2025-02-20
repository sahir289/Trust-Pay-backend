import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
const tableName = 'ResetHistory';



const getResetHistoryDao = async (id) => {
const query = `SELECT *  FROM  "${tableName}" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, {id} );
   const result = await executeQuery(sql, parameters);
   return result.rows[0];
};

const createResetHistoryDao = async (payload ) => {
    const [sql, params] = buildInsertQuery(tableName, payload)
        const result = await executeQuery(sql, params);
        return result.rows[0];

  
};

const updateResetHistoryDao = async (id, data) => {
   
  const [sql, params] = buildUpdateQuery(tableName, data, {id});
  const result = await executeQuery(sql, params);
  return result.rows[0];
  
};



const deleteResetHistoryDao = async ( id, data) => {
  const [sql, params] = buildUpdateQuery(tableName, data, {id});
  const result = await executeQuery(sql, params);
  return result.rows[0];

  
};


export {  getResetHistoryDao, createResetHistoryDao, updateResetHistoryDao, deleteResetHistoryDao };
