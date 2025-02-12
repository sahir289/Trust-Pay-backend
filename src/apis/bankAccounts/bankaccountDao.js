import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
const tableName = 'BankAccount';

const getBankaccountDao = async ({
  searchString,
  page = 1,
  pageSize = 10,
  sortBy = "updated_at",  // Default sorting column
  sortOrder = "DESC" // ASC (ascending) or DESC (descending)
} = {}) => {
  // Fetch column names dynamically (assuming a metadata function exists)
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
      sortBy = "updated_at"; // Fallback to 'updated_at' if invalid column
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

const getMerchantBankByIdDao = async (user_id) => {
  const query = `SELECT * FROM  "${tableName}" WHERE 1=1`;
  const [sql, parameters] = buildSelectQuery(query, { user_id });
  const result = await executeQuery(sql, parameters);
  return result.rows;
}

const createBankaccountByIdDao = async (payload) => {
  const [sql, params] = buildInsertQuery(tableName, payload)
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const updateBankaccountByIdDao = async (id, payload) => {
  const [sql, params] = buildUpdateQuery(tableName, payload, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const deleteBankaccountByIdDao = async (id, data) => {
  const [sql, params] = buildUpdateQuery(tableName, data, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

export { getBankaccountDao, createBankaccountByIdDao, updateBankaccountByIdDao, deleteBankaccountByIdDao, getMerchantBankByIdDao };
