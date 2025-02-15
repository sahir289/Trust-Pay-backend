
import {   executeQuery,buildInsertQuery ,buildUpdateQuery,buildSelectQuery   } from "../../utils/db.js";
import { columns,tableName } from "../../constants/index.js";

const getComplaintsDao =async (
  search,
  page,
  pageSize,
  sortBy,
  sortOrder
) => {
  const baseQuery = `SELECT * FROM "${tableName.COMPLAINTS}" WHERE 1=1`;
  const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.COMPLAINTS, page, pageSize, sortBy, sortOrder, typeof search != 'string');
  // Execute query
  const result = await executeQuery(sql, queryParams);
  return result.rows;
};

const createComplaintsDao = async (data) => {  
            // data.id = generateUUID();
       const [sql, params] = buildInsertQuery(tableName.COMPLAINTS, data)
         const result = await executeQuery(sql, params);
         return result.rows[0];
};

const updateComplaintsDao = async (id,data) => {  
     const [sql, params] = buildUpdateQuery(tableName.COMPLAINTS, data, { id });
       const result = await executeQuery(sql, params);
       return result.rows[0];
}

const deleteComplaintsDao = async (id,data) => { 
        const [sql, params] = buildUpdateQuery(tableName.COMPLAINTS, data, { id});
        const result = await executeQuery(sql, params);
        return result.rows[0];
}

export {getComplaintsDao , createComplaintsDao ,updateComplaintsDao , deleteComplaintsDao}