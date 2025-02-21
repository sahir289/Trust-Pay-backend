import { columns, tableName } from "../../constants/index.js";
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from "../../utils/db.js";

// Create Chargeback entry
export const createChargeBackDao = async (data) => {
    try {
        const [sql, params] = buildInsertQuery(tableName.CHAREBACK, data);
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error("Error creating ChargeBack entry:", error);
        throw new Error("Error creating ChargeBack entry");
    }
};

// Get Chargeback entries with pagination, sorting, and filtering
export const getChargeBackDao = async (
    search,
    page,
    pageSize,
    sortBy,
    sortOrder
) => {
    try {
        // Explicitly list columns instead of using *
        const columnsToSelect = `id,
            user, merchant_user_id, vendor_user_id, payin_id, 
            bank_acc_id, amount, "when", created_by, updated_by, 
            created_at, updated_at
        `;
        const baseQuery = `SELECT ${columnsToSelect} FROM "${tableName.CHAREBACK}" WHERE 1=1`;
        const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.CHAREBACK, page, pageSize, sortBy, sortOrder, typeof search !== 'string');
        const result = await executeQuery(sql, queryParams);
        return result.rows;
    } catch (error) {
        console.error("Error fetching ChargeBack entries:", error);
        throw new Error("Error fetching ChargeBack entries");
    }
};

// Update Chargeback entry
export const updateChargeBackDao = async (id, company_id, data) => {
    try {
        const [sql, params] = buildUpdateQuery(tableName.CHAREBACK, data, { id, company_id });
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error("Error updating ChargeBack entry:", error);
        throw new Error("Error updating ChargeBack entry");
    }
};

// Delete Chargeback entry
export const deleteChargeBackDao = async (id, company_id, data) => {
    try {
        const [sql, params] = buildUpdateQuery(tableName.CHAREBACK, data, { id, company_id });
        const result = await executeQuery(sql, params);
        return result.rows[0];
    } catch (error) {
        console.error("Error deleting ChargeBack entry:", error);
        throw new Error("Error deleting ChargeBack entry");
    }
};
