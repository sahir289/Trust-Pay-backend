
import {   executeQuery,buildSelectQuery,buildInsertQuery ,buildUpdateQuery   } from "../../utils/db.js";



const tableName = "Complaints";

const getComplaintsDao = async (filters = {}) => {
      const baseQuery = `SELECT * FROM public."Complaints"`;
      const [sql, queryParams] = buildSelectQuery(baseQuery, filters);
      const rows = await executeQuery(sql, queryParams);
      return rows.rows;
  };

const createComplaintsDao = async (data) => {  
            // data.id = generateUUID();
       const [sql, params] = buildInsertQuery(tableName, data)
         const result = await executeQuery(sql, params);
         return result.rows[0];
};

const updateComplaintsDao = async (id,data) => {  
     const [sql, params] = buildUpdateQuery(tableName, data, { id });
       const result = await executeQuery(sql, params);
       return result.rows[0];
}
const deleteComplaintsDao = async (id,data) => { 
        const [sql, params] = buildUpdateQuery(tableName, data, { id});
        const result = await executeQuery(sql, params);
        return result.rows[0];
}

export {getComplaintsDao , createComplaintsDao ,updateComplaintsDao , deleteComplaintsDao}