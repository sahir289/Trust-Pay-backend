import { buildInsertQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

const tableName = 'Vendor';

export const createVendorDao = async (data) => {
    const [sql, params] = buildInsertQuery(tableName, data)
    const result = await executeQuery(sql, params);
    return result.rows[0];
}

export const getVendorsDao = async ({
    searchString,
    page = 1,
    pageSize = 10,
    sortBy = "sno",  // Default sorting column (change as needed)
    sortOrder = "DESC" // ASC (ascending) or DESC (descending)
} = {}) => {
    // Fetch column names dynamically (assuming a metadata function exists)
    const columnQuery = `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}'`;
    const columnResult = await executeQuery(columnQuery);
    const searchColumns = columnResult.rows.map(row => row.column_name);

    let query = `SELECT * FROM "${tableName}"`;
    let values = [];

    // Handle searching
    if (searchString.trim() && searchColumns.length > 0) {
        const searchValues = searchString.split(",").map(val => val.trim()); // Split & clean values
        const conditions = searchValues.map((_, index) => 
            `(${searchColumns.map(col => `"${col}"::TEXT ILIKE $${index + 1}`).join(" OR ")})`
        ).join(" OR ");

        query += ` WHERE ${conditions}`;
        values = searchValues.map(val => `%${val}%`); // Use ILIKE for partial matches
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


export const updateVendorDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}
export const deleteVendorDao = async (id, data) => {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
}