import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildJoinQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

// Create ChargeBack entry
export const createChargeBackDao = async (data) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.CHARGE_BACK, data);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating ChargeBack entry:', error);
    throw error.message;
  }
};

// Get ChargeBack entries with pagination, sorting, and filtering
export const getChargeBackDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  // columns to select from db (optional)
  columns = [],
) => {
  try {
    const { VENDOR, CHARGE_BACK, MERCHANT, PAYIN } = tableName;
    const joins = [
      {
        table: VENDOR,
        // first is source key
        // second is target key
        keys: ['vendor_user_id', 'user_id'], // Fixed syntax by adding quotes around keys
        type: 'LEFT JOIN',
        columnAs: [`"${VENDOR}".code AS vendor_name`],
      },
      {
        table: MERCHANT,
        // first is source key
        // second is target key
        keys: ['merchant_user_id', 'user_id'], // Fixed syntax by adding quotes around keys
        type: 'LEFT JOIN',
        columnAs: [`"${MERCHANT}".code AS merchant_name`],
      },
      {
        table: PAYIN,
        // first is source key
        // second is target key
        keys: ['payin_id', 'id'],
        type: 'LEFT JOIN',
        columns: ['user', 'merchant_order_id'],
      },
    ];

    const baseQuery = buildJoinQuery(
      CHARGE_BACK,
      columns.length ? columns : '*',
      joins,
    );

    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, CHARGE_BACK);
      delete filters.search;
    }
    // console.log(JSON.stringify(filters, undefined, 4));
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      tableName.CHARGE_BACK,
    );
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error fetching ChargeBack entries:', error);
    throw error.message;
  }
};



export const getChargeBacksBySearchDao = async (
  filters,
  searchTerms,
  limitNum,
  offset,
) => {
  try {
    const { VENDOR, CHARGE_BACK, MERCHANT, PAYIN } = tableName;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    const joins = [
      {
        table: VENDOR,
        keys: ['vendor_user_id', 'user_id'],
        type: 'LEFT JOIN',
        columnAs: [`"${VENDOR}".code AS vendor_name`],
      },
      {
        table: MERCHANT,
        keys: ['merchant_user_id', 'user_id'],
        type: 'LEFT JOIN',
        columnAs: [`"${MERCHANT}".code AS merchant_name`],
      },
      {
        table: PAYIN,
        keys: ['payin_id', 'id'],
        type: 'LEFT JOIN',
        columns: ['user', 'merchant_order_id'],
      },
    ];

    let queryText = `
      SELECT 
        "${CHARGE_BACK}".id,
        "${CHARGE_BACK}".sno,
        "${CHARGE_BACK}".merchant_user_id,
        "${CHARGE_BACK}".vendor_user_id,
        "${CHARGE_BACK}".payin_id,
        "${CHARGE_BACK}".bank_acc_id,
        "${CHARGE_BACK}".amount,
        "${CHARGE_BACK}".when,
        "${CHARGE_BACK}".created_by,
        "${CHARGE_BACK}".updated_by,
        "${CHARGE_BACK}".created_at,
        "${CHARGE_BACK}".updated_at,
        ${joins[0].columnAs[0]},  -- vendor_name
        ${joins[1].columnAs[0]},  -- merchant_name
        "${PAYIN}".user AS payin_user,
        "${PAYIN}".merchant_order_id
      FROM "${CHARGE_BACK}"
      ${joins
        .map(
          (join) => `
        ${join.type} "${join.table}"
        ON "${CHARGE_BACK}"."${join.keys[0]}" = "${join.table}"."${join.keys[1]}"
      `,
        )
        .join('')}
      WHERE 1=1
    `;

    if (filters && filters.company_id) {
      queryText += ` AND "${CHARGE_BACK}".company_id = $${paramIndex}`;
      values.push(filters.company_id);
      paramIndex++;
    }

    // Build search conditions across all relevant fields
    searchTerms.forEach((term) => {
      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolValue = term.toLowerCase() === 'true';
        conditions.push(`
          (
            "${CHARGE_BACK}".amount > 0 = $${paramIndex}  
          )
        `);
        values.push(boolValue);
        paramIndex++;
      } else {
        conditions.push(`
          (
            LOWER("${CHARGE_BACK}".id::text) LIKE LOWER($${paramIndex})
            OR LOWER("${CHARGE_BACK}".sno::text) LIKE LOWER($${paramIndex})
            OR LOWER("${CHARGE_BACK}".merchant_user_id::text) LIKE LOWER($${paramIndex})
            OR LOWER("${CHARGE_BACK}".vendor_user_id::text) LIKE LOWER($${paramIndex})
            OR LOWER("${CHARGE_BACK}".payin_id::text) LIKE LOWER($${paramIndex})
            OR LOWER("${CHARGE_BACK}".bank_acc_id::text) LIKE LOWER($${paramIndex})
            OR LOWER("${CHARGE_BACK}".amount::text) LIKE LOWER($${paramIndex})
            OR LOWER("${CHARGE_BACK}".when::text) LIKE LOWER($${paramIndex})
            OR LOWER("${CHARGE_BACK}".created_by::text) LIKE LOWER($${paramIndex})
            OR LOWER("${CHARGE_BACK}".updated_by::text) LIKE LOWER($${paramIndex})
            OR LOWER("${VENDOR}".code) LIKE LOWER($${paramIndex})
            OR LOWER("${MERCHANT}".code) LIKE LOWER($${paramIndex})
            OR LOWER("${PAYIN}".user) LIKE LOWER($${paramIndex})
            OR LOWER("${PAYIN}".merchant_order_id) LIKE LOWER($${paramIndex})
          )
        `);
        values.push(`%${term}%`);
        paramIndex++;
      }
    });

    if (conditions.length > 0) {
      queryText += ' AND (' + conditions.join(' OR ') + ')';
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${queryText}) as count_table`;

    queryText += `
      ORDER BY "${CHARGE_BACK}".created_at DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    values.push(limitNum, offset);

    // Execute queries
    const countResult = await executeQuery(countQuery, values.slice(0, -2));
    const searchResult = await executeQuery(queryText, values);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limitNum);

    const data = {
      totalCount: totalItems,
      totalPages,
      chargeBacks: searchResult.rows,
    };
    return data;
  } catch (error) {
    console.error('Error fetching ChargeBacks by search:', error.message);
    throw error.message;
  }
};

// Update ChargeBack entry
export const updateChargeBackDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CHARGE_BACK, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating ChargeBack entry:', error);
    throw error.message;
  }
};

// Delete ChargeBack entry
export const deleteChargeBackDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CHARGE_BACK, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting ChargeBack entry:', error);
    throw error.message;
  }
};
