
import {   executeQuery,buildInsertQuery ,buildUpdateQuery   } from "../../utils/db.js";

const tableName = "Complaints";

const getComplaintsDao =async ({
  searchString,
  page = 1,
  pageSize = 10,
  sortBy = "created_at",  // Default sorting column
  sortOrder = "DESC" // ASC (ascending) or DESC (descending)
} = {}) => {
      const baseQuery = `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}'`;
      const columnResult = await executeQuery(baseQuery);
      const searchColumns = columnResult.rows.map(row => row.column_name);

      let query = `SELECT * FROM "${tableName}"`;
      let values = [];
      let conditions = [];
      if (searchString?.trim() && searchColumns?.length > 0) {
        const searchValues = searchString.split(",").map(val => val.trim());
        const searchConditions = searchValues.map((_, index) => 
            `(${searchColumns.map(col => `"${col}"::TEXT ILIKE $${values.length + index + 1}`).join(" OR ")})`
        ).join(" OR ");
        
        conditions.push(searchConditions);
        values.push(...searchValues.map(val => `%${val}%`));
    }

    // Apply conditions if any exist
    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
    }

    // Ensure sorting column exists
    if (!searchColumns.includes(sortBy)) {
        sortBy = "created_at"; // Fallback to 'created_at' if invalid column
    }

    // Ensure sorting order is valid
    const order = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

    // Add sorting
    query += ` ORDER BY "${sortBy}" ${order}`;

    // Add pagination
    const offset = (page - 1) * pageSize;
    query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(pageSize, offset);

    const result = await executeQuery(query, values);
    return result.rows;
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