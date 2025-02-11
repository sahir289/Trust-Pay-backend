import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
const tableName = 'Designation';



const getDesignationByIdDao = async (id) => {
const query = `SELECT id, designation, role_id, created_by, created_at, updated_at, company_id  FROM  "${tableName}" WHERE 1=1`;
   const [sql, parameters] = buildSelectQuery(query, {id} );
   const result = await executeQuery(sql, parameters);
   return result.rows[0];
};

const createDesignationByIdDao = async (payload ) => {
    const [sql, params] = buildInsertQuery(tableName, payload)
        const result = await executeQuery(sql, params);
        return result.rows[0];

  
};

const updateDesignationByIdDao = async (id, data) => {
   
  const [sql, params] = buildUpdateQuery(tableName, data, {id});
  const result = await executeQuery(sql, params);
  return result.rows[0];
  
};



const deleteDesignationByIdDao = async ( id, data) => {
  const [sql, params] = buildUpdateQuery(tableName, data, {id});
  const result = await executeQuery(sql, params);
  return result.rows[0];

  
};


export {  getDesignationByIdDao, createDesignationByIdDao, updateDesignationByIdDao, deleteDesignationByIdDao };
