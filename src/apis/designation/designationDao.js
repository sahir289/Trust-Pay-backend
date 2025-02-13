import { buildInsertQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
const tableName = 'Designation';

const getDesignationByIdDao = async ({
  id = null,
  searchString = "",
  page = 1,
  pageSize = 10,
  sortBy = "sno",  // Default sorting column
  sortOrder = "DESC" // ASC (ascending) or DESC (descending)
} = {}) => {
  // Fetch column names dynamically
  const columnQuery = `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}'`;
  const columnResult = await executeQuery(columnQuery);
  const searchColumns = columnResult.rows.map(row => row.column_name);

  let query = `SELECT * FROM "${tableName}" WHERE 1=1`;
  let values = [];
  let conditions = [];

  // Filter by ID if provided
  if (id !== null) {
      conditions.push(`id = $${values.length + 1}`);
      values.push(id);
  }

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
      sortBy = "sno"; // Fallback to 'id' if invalid column
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


const createDesignationDao = async (payload) => {
  const [sql, params] = buildInsertQuery(tableName, payload)
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const updateDesignationDao = async (id, data) => {

  const [sql, params] = buildUpdateQuery(tableName, data, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];

};

const deleteDesignationDao = async (id, data) => {
  const [sql, params] = buildUpdateQuery(tableName, data, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];


};

<<<<<<< HEAD
export { getDesignationByIdDao, createDesignationByIdDao, updateDesignationByIdDao, deleteDesignationByIdDao };
=======
export { getDesignationDao, createDesignationDao, updateDesignationDao, deleteDesignationDao };
>>>>>>> 37570f3 (removed ById)
