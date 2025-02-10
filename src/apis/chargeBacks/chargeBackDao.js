import { DbError } from '../../utils/appErrors.js';
import { generateUUID } from '../../utils/generateUUID.js';


const createChargeBackDao = async (conn, payload) => {
    // Destructure payload with default values
    const {
        user,
        merchantUserId,
        vendorUserId,
        payInId,
        bankAccountId,
        amount,
        when,
        companyId,
    } = payload;

    // Generate unique identifiers
    const id = generateUUID();

    // Default values
    const defaults = {
        firstName: "",
        lastName: "",
        createdBy: "",
        updatedBy: "",
        isObsolete: false,
    };

    // Prepare SQL query
    const sql = `
      INSERT INTO Chargeback (
        id, user, merchant_user_id, vendor_user_id, payin_id, 
        bank_acc_id, amount, when, created_by, 
        updated_by, is_obsolete, company_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 12
      ) RETURNING *;
    `;

    // Organize parameter values
    const values = [
        id, user, merchantUserId, vendorUserId, payInId,
        bankAccountId, amount, when,
        defaults.createdBy, defaults.updatedBy,
        defaults.isObsolete, companyId,
    ];

    try {
        // Execute the query
        const result = await conn.query(sql, values);

        return result.rows?.[0] || null; // Return the inserted row or null if none
    } catch (error) {
        // Log contextual error details
        console.error('Error in createChargeBackDao', error);

        // Re-throw a generic database error
        throw new DbError('Failed to create ChargeBack.');
    }
};

const getChargeBackDao = async (conn, filters = {}) => {
    // Base SQL query and parameters
    let sql = 'SELECT * FROM Chargeback WHERE 1=1';
    const conditions = [];
    const queryParams = [];

    // Map of filter keys to their SQL column names
    const filtersMap = {
        id: 'id',
        sno:'sno',
        user: 'user',
        merchantUserId:'merchant_user_id',
        vendorUserId:'vendor_user_id',
        payInId: 'payin_id',
        bankAccountId: 'bank_acc_id',
        amount: 'amount',
        when: 'when',
        createdBy: 'created_by',
        updatedBy: 'updated_by',
        isObsolete: 'is_obsolete',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
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
        console.error('Error fetching ChargeBacks', error);

        // Re-throw the error
        throw new DbError('Failed to fetch ChargeBacks');
    }
};

const updateChargeBackDao = async (conn, payload) => {
    const {
        id, // ChargeBack ID to update
        user,
        merchantUserId,
        vendorUserId,
        payInId,
        bankAccountId,
        amount,
        when,
        companyId,
        updatedBy,
    } = payload;

    // Prepare SQL query
    const sql = `
      UPDATE Chargeback
      SET 
        user = $2, 
        merchant_user_id = $3, 
        vendor_user_id = $4, 
        payin_id = $5, 
        bank_acc_id = $6, 
        amount = $7, 
        when = $8, 
        updated_by = $9, 
        company_id = $10,
      WHERE id = $1
      RETURNING *;
    `;

    const values = [
        id, user, merchantUserId, vendorUserId, payInId, bankAccountId, 
        amount, when, updatedBy, companyId
    ];

    try {
        const result = await conn.query(sql, values);
        return result.rows?.[0] || null; // Return the updated row or null if not found
    } catch (error) {
     console.error('Error in updateChargeBackDao', error);
        throw new DbError('Failed to update ChargeBack.');
    }
};

const deleteChargeBackDao = async (conn, chargeBackId) => {
    // Prepare SQL query for soft delete (setting is_obsolete to true)
    const sql = `
      UPDATE Chargeback
      SET is_obsolete = true
      WHERE id = $1
      RETURNING *;
    `;

    const values = [chargeBackId];

    try {
        const result = await conn.query(sql, values);
        return result.rows?.[0] || null; // Return the deleted ChargeBack row or null if not found
    } catch (error) {
        console.error('Error in deleteChargeBackDao', error);
        throw new DbError('Failed to delete ChargeBack.');
    }
};

export { createChargeBackDao, getChargeBackDao, updateChargeBackDao, deleteChargeBackDao };