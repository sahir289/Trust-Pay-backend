import { Role, tableName } from '../../constants/index.js';

import {
  buildInsertQuery,
  buildUpdateQuery,
  buildAndExecuteUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { DbError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';

const getBeneficiaryAccountDao = async (filters, page, limit, role) => {
  try {
    let queryParams = [];
    let conditions = [`bea.is_obsolete = false`];
    let limitcondition = '';

    if (page && limit) {
      limitcondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, (page - 1) * limit);
    }
    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).forEach((key) => {
        delete filters?.page;
        delete filters?.limit;
        const value = filters[key];
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            conditions.push(`bea."${key}" = ANY($${queryParams.length + 1})`);
            queryParams.push(value);
          } else {
            conditions.push(`bea."${key}" = $${queryParams.length + 1}`);
            queryParams.push(value);
          }
        }
      });
    }
    let commissionSelect = '';
    if (role === Role.MERCHANT) {
      commissionSelect = `
        bea.ifsc AS ifsc`;
    } else if (role === Role.VENDOR) {
      commissionSelect = `
        bea.ifsc AS ifsc, bea.config`;
    } else {
      commissionSelect = `
        bea.user_id, 
        bea.ifsc, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        bea.created_at,
        bea.config,
        bea.updated_at`;
    }
    const baseQuery = `SELECT 
        bea.id,
        bea.upi_id,
        bea.acc_holder_name,
        bea.acc_no, 
        bea.bank_name,
        ${commissionSelect ? `${commissionSelect},` : ''}
        v.code AS Vendor,
        m.code AS Merchant
      FROM 
          public."BeneficiaryAccounts" bea
      LEFT JOIN public."Vendor" v 
          ON bea.user_id = v.user_id
      LEFT JOIN public."Merchant" m 
          ON bea.user_id = m.user_id
       LEFT JOIN public."User" creator 
        ON bea.created_by = creator.id
      LEFT JOIN public."User" updater 
        ON bea.updated_by = updater.id
      WHERE 
          ${conditions.join(' AND ')}
      ORDER BY 
          bea.updated_at DESC  
      ${limitcondition};
      `;
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in get BeneficiaryAccount Dao:', error);
    throw error.message;
  }
};
const getBeneficiaryAccountBySearchDao = async (
  role,
  searchTerms = [],
  page = 1,
  limit = 10,
  filters = {},
) => {
  try {
    let queryParams = [];
    let conditions = [`bea.is_obsolete = false`];
    let paramIndex = 1;

    if (
      filters &&
      typeof filters === 'object' &&
      Object.keys(filters).length > 0
    ) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            conditions.push(`bea."${key}" = ANY($${paramIndex})`);
            queryParams.push(value);
          } else {
            conditions.push(`bea."${key}" = $${paramIndex}`);
            queryParams.push(value);
          }
          paramIndex++;
        }
      });
    }
    let commissionSelect = '';
    if (role === 'MERCHANT' || role === 'VENDOR') {
      commissionSelect = `bea.ifsc,`;
    } else {
      commissionSelect = `
        bea.user_id, 
        bea.ifsc, 
        bea.config, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        bea.created_at, 
        bea.updated_at,
      `;
    }

    let baseQuery = `
      SELECT 
        bea.id, 
        bea.upi_id,
        bea.acc_holder_name,
        bea.acc_no, 
        bea.bank_name, 
        ${commissionSelect}
        v.code AS Vendor, 
        m.code AS Merchant
      FROM 
        public."BeneficiaryAccounts" bea
      LEFT JOIN public."Vendor" v 
        ON bea.user_id = v.user_id
      LEFT JOIN public."Merchant" m 
        ON bea.user_id = m.user_id
      LEFT JOIN public."User" creator 
        ON bea.created_by = creator.id
      LEFT JOIN public."User" updater 
        ON bea.updated_by = updater.id
      WHERE 1=1
    `;

    const searchConditions = [];
    if (Array.isArray(searchTerms) && searchTerms.length > 0) {
      searchTerms.forEach((term) => {
        if (typeof term !== 'string') return;
        if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
          const boolValue = term.toLowerCase() === 'true';
          searchConditions.push(`
            (
              bea.is_qr = $${paramIndex}
              OR bea.is_bank = $${paramIndex}
              OR bea.is_enabled = $${paramIndex}
            )
          `);
          queryParams.push(boolValue);
        } else {
          searchConditions.push(`
            (
              LOWER(bea.id::text) LIKE LOWER($${paramIndex})
              OR LOWER(bea.upi_id) LIKE LOWER($${paramIndex})
              OR LOWER(bea.acc_holder_name) LIKE LOWER($${paramIndex})
              OR LOWER(bea.acc_no) LIKE LOWER($${paramIndex})
              OR LOWER(bea.bank_name) LIKE LOWER($${paramIndex})
              OR LOWER(v.code) LIKE LOWER($${paramIndex})
              OR LOWER(m.code) LIKE LOWER($${paramIndex})
              ${
                role !== 'MERCHANT'
                  ? `
                OR LOWER(bea.user_id::text) LIKE LOWER($${paramIndex})
                OR LOWER(bea.ifsc) LIKE LOWER($${paramIndex})
                ${
                  role !== 'VENDOR'
                    ? `
                  OR LOWER(creator.user_name) LIKE LOWER($${paramIndex})
                  OR LOWER(updater.user_name) LIKE LOWER($${paramIndex})
                `
                    : ''
                }
              `
                  : role === 'VENDOR'
                    ? `
                OR LOWER(bea.ifsc) LIKE LOWER($${paramIndex})
              `
                    : ''
              }
            )
          `);
          queryParams.push(`%${term}%`);
        }
        paramIndex++;
      });
    }

    if (conditions.length > 0) {
      baseQuery += ' AND ' + conditions.join(' AND ');
    }
    if (searchConditions.length > 0) {
      baseQuery += ' AND (' + searchConditions.join(' OR ') + ')';
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as count_table`;
    const countResult = await executeQuery(countQuery, queryParams);

    const offset = (page - 1) * limit;
    baseQuery += `
      ORDER BY 
        bea.updated_at DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    queryParams.push(limit, offset);

    const searchResult = await executeQuery(baseQuery, queryParams);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;

   

    return {
      totalCount: totalItems,
      totalPages,
      bankAccounts: searchResult.rows,
    };
  } catch (error) {
    logger.error('Error in get Beneficiary Account By SearchDao:',error);
    throw error;
  }
};

const createBeneficiaryAccountDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.BENEFICIARY_ACCOUNTS, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error(error);
    throw error.message;
  }
};

const getBeneficiaryAccountDaoByBankName = async (
  conn,
  company_id,
  type,
  filters = {},
) => {
  try {
    // Initialize query components
    let whereConditions = [
      'is_obsolete = false',
    ];
    let queryParams = [];

    // Handle filters
    if (Object.keys(filters).length > 0) {
      Object.entries(filters).forEach(([key, value]) => {
        let paramValue = value;
        // If value is an array, take the first element (adjust based on requirements)
        if (Array.isArray(value) && value.length > 0) {
          paramValue = value[0]; // Extract first element
          if (paramValue == null) {
            return; // Skip if first element is null/undefined
          }
        }
        whereConditions.push(`"${key}" = $${queryParams.length + 1}`);
        queryParams.push(paramValue);
      });
    }

    // Construct base query with dynamic WHERE clause
    let baseQuery = `
      SELECT bank_name AS label, id AS value 
      FROM "${tableName.BENEFICIARY_ACCOUNTS}" 
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY bank_name ASC
    `;

    // Execute query
    const result = await conn.query(baseQuery, queryParams);

    return {
      totalCount: result.rowCount,
      bankNames: result.rows,
    };
  } catch (error) {
    logger.error('Error querying bank accounts:', error.message, error.stack);
    throw new Error('Failed to retrieve bank account nicknames');
  }
};

const updateBeneficiaryAccountDao = async (
  id,
  payload,
  conn,
  isParentDeleted,
) => {
  try {
    // Fetch existing bank config to merge with added_at
    const existingBankArr = await getBeneficiaryAccountDao({
      id: id.id,
    });
    const existingBank = existingBankArr[0];

    // Handle nested JSON updates for the `config` column
    if (payload.config && typeof payload.config === 'object') {
      const configUpdates = payload.config;
      delete payload.config; // Remove `config` from the main payload

      // Merge the new `config` data into the existing JSON structure
      const safeConfig = {};
      //added merchant_added key in config
      for (const key in configUpdates) {
        if (
          key === 'merchant_added' &&
          typeof configUpdates[key] === 'object'
        ) {
          const rawAddedAt = configUpdates[key];
          const existingAddedAt = existingBank?.config?.merchant_added || {};

          const updatedAddedAt = {
            ...existingAddedAt,
            ...rawAddedAt,
          };

          safeConfig['merchant_added'] = updatedAddedAt;
        } else {
          safeConfig[key] = configUpdates[key];
        }
      }
      payload.config = safeConfig;
    }

    // if vendor delete then this config updated
    if (isParentDeleted) {
      const [sql, params] = buildUpdateQuery(
        tableName.BENEFICIARY_ACCOUNTS,
        payload,
        id,
      );
      return await conn.query(sql, params);
    }
    // Use buildAndExecuteUpdateQuery to update the bank account
    return await buildAndExecuteUpdateQuery(
      tableName.BENEFICIARY_ACCOUNTS,
      payload,
      id,
      {}, // No special fields
      { returnUpdated: true }, // Return the updated row
      conn, // Use the provided connection
    );
  } catch (error) {
    logger.error('Error in updateBeneficiaryAccountDao:', error);
    throw error.message;
  }
};

const deleteBankaccountDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BENEFICIARY_ACCOUNTS, data, id);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }
    return result.rows[0];
  } catch {
    DbError('Error executing query');
  }
};

export const updateBanktBalanceDao = async (
  filters,
  amount,
  updated_by,
  conn,
) => {
  try {
    const [sql, params] = buildUpdateQuery(
      tableName.BENEFICIARY_ACCOUNTS,
      { balance: amount, today_balance: amount, updated_by },
      filters,
      { balance: '+', today_balance: '+' },
    );
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result[0];
  } catch (error) {
    logger.error(error);
    throw error.message;
  }
};

export {
  getBeneficiaryAccountDao,
  getBeneficiaryAccountBySearchDao,
  createBeneficiaryAccountDao,
  updateBeneficiaryAccountDao,
  deleteBankaccountDao,
  getBeneficiaryAccountDaoByBankName,
};
