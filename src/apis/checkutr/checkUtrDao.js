import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
const tableName = 'CheckUtr';



const getCheckUtrDao = async (filters) => {
const query = `SELECT *  FROM  "${tableName}" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, filters);
   const result = await executeQuery(sql, parameters);
   return result.rows[0];
};

const createCheckUtrDao = async (payload) => {
    const [sql, params] = buildInsertQuery(tableName, payload)
        const result = await executeQuery(sql, params);
        return result.rows[0];

  
};

const updateCheckUtrDao = async (id, data) => {
   
  const [sql, params] = buildUpdateQuery(tableName, data, {id});
  const result = await executeQuery(sql, params);
  return result.rows[0];
  
};



const deleteCheckUtrDao = async ( id, data) => {
  const [sql, params] = buildUpdateQuery(tableName, data, {id});
  const result = await executeQuery(sql, params);
  return result.rows[0];

  
};


export {  getCheckUtrDao, createCheckUtrDao, updateCheckUtrDao, deleteCheckUtrDao };
