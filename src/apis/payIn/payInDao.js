import { tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

export const generatePayInUrlDao = async (data) => {
    try {
        const [sql, params] = buildInsertQuery(tableName.PAYIN, data);
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error generating PayIn URL:', error); // Log the error for debugging
        throw error; // Rethrow the error to propagate it
    }
}

export const getPayInUrlDao = async (filters) => {
    try {
        const [sql, params] = buildSelectQuery(`SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`, filters);
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error getting PayIn URL:', error); // Log the error for debugging
        throw error; // Rethrow the error to propagate it
    }
}

export const getPayInUrlsDao = async (filters = {}, page, limit) => {
    try {
        const [sql, params] = buildSelectQuery(`SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`, filters, page, limit);
        const result = await executeQuery(sql, params);
        return result.rows;
    } catch (error) {
        console.error('Error getting PayIn URLs:', error); // Log the error for debugging
        throw error; // Rethrow the error to propagate it
    }
}

export const updatePayInUrlDao = async (id, data, conn) => {
    try {
        const [sql, params] = buildUpdateQuery(tableName.PAYIN, data, { id });
        if (conn && conn.query) {
            const result = await conn.query(sql, params);
            return result.rows[0];
        }
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error('Error updating PayIn URL:', error); // Log the error for debugging
        throw error; // Rethrow the error to propagate it
    }
}
