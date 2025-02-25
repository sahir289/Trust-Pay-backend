import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
import { tableName } from '../../constants/index.js';

const getCompanyDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder
) => {
  const baseQuery = `SELECT id,first_name,last_name FROM "${tableName.COMPANY}" WHERE 1=1`;
  //TODO: columns.Company dynamic search
  const [sql, queryParams] = buildSelectQuery(baseQuery, filters, page, pageSize, sortBy, sortOrder);
  // Execute query
  const result = await executeQuery(sql, queryParams);
  return result.rows;
};

const createCompanyDao = async (payload ) => {
    const [sql, params] = buildInsertQuery(tableName.COMPANY, payload)
        const result = await executeQuery(sql, params);
        return result.rows[0];
};

const updateCompanyDao = async (id, data) => {
   
  const [sql, params] = buildUpdateQuery(tableName.COMPANY, data, {id});
  const result = await executeQuery(sql, params);
  return result.rows[0];
  
};



const deleteCompanyDao = async ( id, data) => {
  const [sql, params] = buildUpdateQuery(tableName.COMPANY, data, {id});
  const result = await executeQuery(sql, params);
  return result.rows[0];

  
};


export {  getCompanyDao, createCompanyDao, updateCompanyDao, deleteCompanyDao };
