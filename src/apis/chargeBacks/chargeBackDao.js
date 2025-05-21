import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
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
  columns = [],
  role
) => {
  try {
    const { VENDOR, CHARGE_BACK, MERCHANT, PAYIN, USER } = tableName;

    const conditions = [`cb.is_obsolete = false`];
    const queryParams = [];
    const limitcondition = { value: '' };

    const handledKeys = new Set(['search', 'startDate', 'endDate']);

    const conditionBuilders = {
      search: (filters, CHARGE_BACK) => {
        if (!filters.search || typeof filters.search !== 'string') return;
        try {
          filters.or = buildSearchFilterObj(filters.search, CHARGE_BACK);
          delete filters.search;
        } catch (error) {
          console.warn(`Invalid search filter: ${filters.search}`, error);
          delete filters.search;
        }
      },
      dateRange: (filters, conditions, queryParams) => {
        if (!filters.startDate || !filters.endDate) return;
        const startDate = new Date(filters.startDate);
        const endDate = new Date(filters.endDate);
        const idx = queryParams.length + 1;
        conditions.push(`cb.created_at BETWEEN $${idx} AND $${idx + 1}`); 
        queryParams.push(startDate, endDate);
      },
      pagination: (page, pageSize, queryParams, limitconditionRef) => {
        if (!page || !pageSize) return;
        const nextParamIdx = queryParams.length + 1;
        limitconditionRef.value = `LIMIT $${nextParamIdx} OFFSET $${nextParamIdx + 1}`;
        queryParams.push(pageSize, (page - 1) * pageSize);
      }
    };

    conditionBuilders.search(filters, CHARGE_BACK);
    conditionBuilders.dateRange(filters, conditions, queryParams);
    conditionBuilders.pagination(page, pageSize, queryParams, limitcondition);

    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null) return;
      const nextParamIdx = queryParams.length + 1;

      // Special handling for arrays (like merchant_user_id)
      if (Array.isArray(value)) {
        const placeholders = value.map((_, idx) => `$${nextParamIdx + idx}`).join(', ');
        conditions.push(`cb.${key} IN (${placeholders})`);
        queryParams.push(...value);
      } else {
        const isMultiValue = typeof value === 'string' && value.includes(',');
        const valueArray = isMultiValue ? value.split(',').map(v => v.trim()) : [value];
        const placeholders = valueArray.map((_, idx) => `$${nextParamIdx + idx}`).join(', ');
        conditions.push(isMultiValue ? `cb.${key} IN (${placeholders})` : `cb.${key} = $${nextParamIdx}`);
        queryParams.push(...valueArray);
      }
    });

    const tableAlias = 'cb';

    // Filter out unwanted columns
    columns = columns.filter(col => 
      col !== 'merchant_user_id' && 
      col !== 'payin_id' && 
      col !== 'vendor_user_id'
    );

    // Default columns if none provided
    const defaultColumns = ['id', 'payin_id', 'amount'];
    const baseColumns = columns.length 
      ? columns.map(col => `${tableAlias}.${col}`).join(', ')
      : defaultColumns.map(col => `${tableAlias}.${col}`).join(', ');

    // Additional columns based on role
    let additionalColumns = '';
    if (role !== 'VENDOR') {
      additionalColumns = `
        m.code AS merchant_name,
        p.merchant_order_id AS merchant_order_id,
      `;
    }
    else if (role !== 'MERCHANT') {
      additionalColumns += `
        v.code AS vendor_name,
      `;
    }
    else {
      additionalColumns = `
        m.code AS merchant_name,
        p.merchant_order_id AS merchant_order_id,
        v.code AS vendor_name,
      `;
    }
    //created and updated by with user name
    additionalColumns += `
      v.code AS vendor_name,
      p.user AS user,
      m.config,
      u.user_name AS created_by,
      uu.user_name AS updated_by
    `;

    // Combine all columns
    const allColumns = [baseColumns];
    if (additionalColumns) allColumns.push(additionalColumns);

    // Ensure sortBy is fully qualified if it's a simple column name
    const validSortColumns = ['id', 'sno', 'payin_id', 'amount', 'created_at', 'updated_at'];
    const qualifiedSortBy = validSortColumns.includes(sortBy) ? `cb.${sortBy}` : sortBy;

    const baseQuery = `
      SELECT
        ${allColumns.join(', ')}
      FROM public."${CHARGE_BACK}" cb
      LEFT JOIN public."${VENDOR}" v ON cb.vendor_user_id = v.user_id
      LEFT JOIN public."${MERCHANT}" m ON cb.merchant_user_id = m.user_id
      LEFT JOIN public."${PAYIN}" p ON cb.payin_id = p.id
      LEFT JOIN public."${USER}" u ON cb.created_by = u.id 
      LEFT JOIN public."${USER}" uu ON cb.updated_by = uu.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${qualifiedSortBy} ${sortOrder}
      ${limitcondition.value}
    `;

    const expectedParamCount = (baseQuery.match(/\$\d+/g) || []).length;
    if (expectedParamCount !== queryParams.length) {
      logger.warn('⚠️ Placeholder count does not match parameter count!');
      logger.warn(`Expected: ${expectedParamCount}, Got: ${queryParams.length}`);
    }

    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching ChargeBack entries:', error);
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
        "${CHARGE_BACK}".bank_acc_id,
        "${CHARGE_BACK}".amount,
        "${CHARGE_BACK}".reference_date,
        "${CHARGE_BACK}".created_by,
        "${CHARGE_BACK}".updated_by,
        "${CHARGE_BACK}".created_at,
        "${CHARGE_BACK}".updated_at,
        ${joins[0].columnAs[0]},  -- vendor_name
        ${joins[1].columnAs[0]},  -- merchant_name
        "${PAYIN}".user AS user,
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

    // Handle merchant_user_id array
    if (filters && Array.isArray(filters.merchant_user_id) && filters.merchant_user_id.length > 0) {
      const placeholders = filters.merchant_user_id
        .map((_, idx) => `$${paramIndex + idx}`)
        .join(', ');
      queryText += ` AND "${CHARGE_BACK}".merchant_user_id IN (${placeholders})`;
      values.push(...filters.merchant_user_id);
      paramIndex += filters.merchant_user_id.length;
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
            OR LOWER("${CHARGE_BACK}".reference_date::text) LIKE LOWER($${paramIndex})
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
