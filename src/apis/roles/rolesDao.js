import { sendError } from "../../utils/responseHandlers.js";
import { buildInsertQuery , executeQuery,buildSelectQuery ,buildUpdateQuery  } from "../../utils/db.js";
const tableName = 'Role';

const getRoleDao = async (filters = {}) => {
    try {
      const baseQuery = `SELECT id, role, company_id, created_by, created_at, updated_at 
                         FROM public."Role" 
                         WHERE is_obsolete = false`;
      const [sql, queryParams] = buildSelectQuery(baseQuery, filters);
      const rows = await executeQuery(sql, queryParams);
  
      return rows.rows;
    } catch (error) {
      console.error('Error fetching Roles', error);
      throw new sendError('Failed to fetch Roles');
    }
  };
  
const createRoleDao = async (data) => {  
            // data.id = generateUUID();
       const [sql, params] = buildInsertQuery(tableName, data)
         const result = await executeQuery(sql, params);
         return result.rows[0];
};

const updateRoleDao = async (id,data) => {  
     const [sql, params] = buildUpdateQuery(tableName, data, { id });
       const result = await executeQuery(sql, params);
       return result.rows[0];
}

const deleteRoleDao = async (id,data) => { 
        const [sql, params] = buildUpdateQuery(tableName, data, { id});
        const result = await executeQuery(sql, params);
        return result.rows[0];
}


export { getRoleDao, createRoleDao ,updateRoleDao ,deleteRoleDao};