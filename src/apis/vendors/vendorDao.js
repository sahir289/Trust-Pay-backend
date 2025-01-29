import { DbError } from '../../utils/appErrors.js';
import { generateUUID } from '../../utils/generateUUID.js';
import Logger from '../../utils/logger.js';

const logger = new Logger();

const createVendorDao = async (conn, payload) => {
    // Destructure payload with default values
    const {
        userId,
        roleId,
        code,
        payInCommission,
        payOutCommission,
        balance = 0, // Default balance to 0 if undefined
        companyId,
    } = payload;

    // Generate unique identifiers
    const id = generateUUID();

    // Default values
    const defaults = {
        createdBy: "",
        updatedBy: "",
        firstName: "",
        lastName: "",
        isObsolete: false,
    };

    const config = {}

    // Prepare SQL query
    const sql = `
      INSERT INTO Vendor (
        id, user_id, role_id, first_name, last_name, code, payin_commission, 
        payout_commission, balance, created_by, 
        updated_by, is_obsolete, company_id, config
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 12, 13, 14
      ) RETURNING *;
    `;

    // Organize parameter values
    const values = [
        id, userId, roleId, defaults.firstName, defaults.lastName,
        code, payInCommission, payOutCommission,
        balance, defaults.createdBy, defaults.updatedBy,
        defaults.isObsolete, companyId, config,
    ];

    try {
        // Execute the query
        const result = await conn.query(sql, values);

        return result.rows?.[0] || null; // Return the inserted row or null if none
    } catch (error) {
        // Log contextual error details
        logger.error('Error in createVendorDao', error);

        // Re-throw a generic database error
        throw new DbError('Failed to create Vendor.');
    }
};

const getVendorsDao = async (conn, filters = {}) => {
    // Base SQL query and parameters
    let sql = 'SELECT * FROM Vendor WHERE 1=1';
    const conditions = [];
    const queryParams = [];

    // Map of filter keys to their SQL column names
    const filtersMap = {
        userId: 'user_id',
        roleId: 'role_id',
        companyId: 'company_id',
    };

    // Dynamically build the query
    for (const [key, column] of Object.entries(filtersMap)) {
        const value = filters[key];
        if (value !== undefined && value !== null) {
            conditions.push(`${column} = $${queryParams.length + 1}`);
            queryParams.push(value);
        }
    }

    // Append conditions to the SQL query
    if (conditions.length) {
        sql += ` AND ${conditions.join(' AND ')}`;
    }

    try {
        // Execute the query
        const { rows } = await conn.query(sql, queryParams);
        return rows;
    } catch (error) {
        // Log error details
        logger.error('Error fetching vendors', error);

        // Re-throw the error
        throw new DbError('Failed to fetch Vendors');
    }
};

const updateVendorDao = async (conn, payload) => {
    const {
        id, // Vendor ID to update
        userId,
        roleId,
        code,
        payInCommission,
        payOutCommission,
        balance,
        companyId,
        updatedBy,
    } = payload;
    
    const config = {}

    // Prepare SQL query
    const sql = `
      UPDATE Vendor
      SET 
        user_id = $2, 
        role_id = $3, 
        code = $4, 
        payin_commission = $5, 
        payout_commission = $6, 
        balance = $7, 
        updated_by = $8, 
        company_id = $9,
        config = $10
      WHERE id = $1
      RETURNING *;
    `;

    const values = [
        id, userId, roleId, code, payInCommission, payOutCommission, 
        balance, updatedBy, companyId, config
    ];

    try {
        const result = await conn.query(sql, values);
        return result.rows?.[0] || null; // Return the updated row or null if not found
    } catch (error) {
        logger.error('Error in updateVendorDao', error);
        throw new DbError('Failed to update Vendor.');
    }
};

const deleteVendorDao = async (conn, vendorId) => {
    // Prepare SQL query for soft delete (setting is_obsolete to true)
    const sql = `
      UPDATE Vendor
      SET is_obsolete = true
      WHERE id = $1
      RETURNING *;
    `;

    const values = [vendorId];

    try {
        const result = await conn.query(sql, values);
        return result.rows?.[0] || null; // Return the deleted Vendor row or null if not found
    } catch (error) {
        logger.error('Error in deleteVendorDao', error);
        throw new DbError('Failed to delete Vendor.');
    }
};

export { createVendorDao, getVendorsDao, updateVendorDao, deleteVendorDao };