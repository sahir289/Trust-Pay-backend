import { DbError } from '../../utils/appErrors.js';
import { generateUUID } from '../../utils/generateUUID.js';
import Logger from '../../utils/logger.js';

const logger = new Logger();

const createMerchantDao = async (conn, payload) => {
    // Destructure payload with default values
    const {
        userId,
        roleId,
        code,
        siteUrl,
        notifyUrl,
        returnUrl,
        minPayIn,
        maxPayIn,
        payInCommission,
        minPayOut,
        maxPayOut,
        payOutCommission,
        payOutNotifyUrl,
        balance = 0, // Default balance to 0 if undefined
        companyId,
    } = payload;

    // Generate unique identifiers
    const id = generateUUID();
    const apiKey = generateUUID();
    const publicApiKey = generateUUID();
    const secretKey = generateUUID();

    // Default values
    const defaults = {
        createdBy: "",
        updatedBy: "",
        isTestMode: false,
        isEnable: true,
        disputeEnabled: false,
        isObsolete: false,
    };

    // Prepare SQL query
    const sql = `
      INSERT INTO Merchant (
        id, user_id, role_id, code, site_url, api_key, secret_key, public_api_key, 
        notify_url, return_url, min_payin, max_payin, payin_commission, 
        min_payout, max_payout, payout_commission, payout_notify_url, 
        is_test_mode, is_enable, dispute_enabled, balance, created_by, 
        updated_by, is_obsolete, company_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      ) RETURNING *;
    `;

    // Organize parameter values
    const values = [
        id, userId, roleId, code, siteUrl, apiKey, secretKey, publicApiKey,
        notifyUrl, returnUrl, minPayIn, maxPayIn, payInCommission,
        minPayOut, maxPayOut, payOutCommission, payOutNotifyUrl,
        defaults.isTestMode, defaults.isEnable, defaults.disputeEnabled,
        balance, defaults.createdBy, defaults.updatedBy,
        defaults.isObsolete, companyId,
    ];

    try {
        // Execute the query
        const result = await conn.query(sql, values);

        return result.rows?.[0] || null; // Return the inserted row or null if none
    } catch (error) {
        // Log contextual error details
        logger.error('Error in createMerchantDao', error);

        // Re-throw a generic database error
        throw new DbError('Failed to create Merchant.');
    }
};

const getMerchantsDao = async (conn, filters = {}) => {
    // Base SQL query and parameters
    let sql = 'SELECT * FROM Merchant WHERE 1=1';
    const conditions = [];
    const queryParams = [];

    // Map of filter keys to their SQL column names
    const filtersMap = {
        userId: 'user_id',
        roleId: 'role_id',
        isEnable: 'is_enable',
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
        logger.error('Error fetching merchants', error);

        // Re-throw the error
        throw new DbError('Failed to fetch merchants');
    }
};

const updateMerchantDao = async (conn, payload) => {
    const {
        id, // Merchant ID to update
        userId,
        roleId,
        code,
        siteUrl,
        notifyUrl,
        returnUrl,
        minPayIn,
        maxPayIn,
        payInCommission,
        minPayOut,
        maxPayOut,
        payOutCommission,
        payOutNotifyUrl,
        balance,
        companyId,
        updatedBy, // Assume the user updating the Merchant
    } = payload;

    // Prepare SQL query
    const sql = `
      UPDATE Merchant
      SET 
        user_id = $2, 
        role_id = $3, 
        code = $4, 
        site_url = $5, 
        notify_url = $6, 
        return_url = $7, 
        min_payin = $8, 
        max_payin = $9, 
        payin_commission = $10, 
        min_payout = $11, 
        max_payout = $12, 
        payout_commission = $13, 
        payout_notify_url = $14, 
        balance = $15, 
        updated_by = $16, 
        company_id = $17
      WHERE id = $1
      RETURNING *;
    `;

    const values = [
        id, userId, roleId, code, siteUrl, notifyUrl, returnUrl, minPayIn, 
        maxPayIn, payInCommission, minPayOut, maxPayOut, payOutCommission, 
        payOutNotifyUrl, balance, updatedBy, companyId
    ];

    try {
        const result = await conn.query(sql, values);
        return result.rows?.[0] || null; // Return the updated row or null if not found
    } catch (error) {
        logger.error('Error in updateMerchantDao', error);
        throw new DbError('Failed to update Merchant.');
    }
};

const deleteMerchantDao = async (conn, merchantId) => {
    // Prepare SQL query for soft delete (setting is_obsolete to true)
    const sql = `
      UPDATE Merchant
      SET is_obsolete = true
      WHERE id = $1
      RETURNING *;
    `;

    const values = [merchantId];

    try {
        const result = await conn.query(sql, values);
        return result.rows?.[0] || null; // Return the deleted Merchant row or null if not found
    } catch (error) {
        logger.error('Error in deleteMerchantDao', error);
        throw new DbError('Failed to delete Merchant.');
    }
};

export { createMerchantDao, getMerchantsDao, updateMerchantDao, deleteMerchantDao };