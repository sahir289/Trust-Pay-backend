import { buildInsertQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
const tableName = 'Designation';

const getDesignationDao = async ({
  searchString,
  page = 1,
  pageSize = 10,
  sortBy = "created_at",  // Default sorting column
  sortOrder = "DESC" // ASC (ascending) or DESC (descending)
} = {}) => {
  // Fetch column names dynamically
  const columnQuery = `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}'`;
  const columnResult = await executeQuery(columnQuery);
  const searchColumns = columnResult.rows.map(row => row.column_name);

  let query = `SELECT * FROM "${tableName}" WHERE 1=1`;
  let values = [];
  let conditions = [];

  // Handle searching across all columns
  if (searchString.trim() && searchColumns.length > 0) {
      const searchValues = searchString.split(",").map(val => val.trim());
      const searchConditions = searchValues.map((_, index) => 
          `(${searchColumns.map(col => `"${col}"::TEXT ILIKE $${values.length + index + 1}`).join(" OR ")})`
      ).join(" OR ");
      
      conditions.push(searchConditions);
      values.push(...searchValues.map(val => `%${val}%`));
  }

  // Apply conditions if any exist
  if (conditions.length > 0) {
      query += ` AND ${conditions.join(" AND ")}`;
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


const createDesignationByIdDao = async (payload) => {
  const [sql, params] = buildInsertQuery(tableName, payload)
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const updateDesignationByIdDao = async (id, data) => {

  const [sql, params] = buildUpdateQuery(tableName, data, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];

};

const deleteDesignationByIdDao = async (id, data) => {
  const [sql, params] = buildUpdateQuery(tableName, data, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];


};

export { getDesignationDao, createDesignationByIdDao, updateDesignationByIdDao, deleteDesignationByIdDao };
