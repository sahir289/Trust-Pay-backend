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
    const { VENDOR, CHARGE_BACK, MERCHANT, PAYIN } = tableName;

    const conditions = [`cb.is_obsolete = false`];
    const queryParams = [];
    const limitcondition = { value: '' };

    const handledKeys = new Set(['search', 'startDate', 'endDate', 'status']);

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
      status: (filters, conditions, queryParams) => {
        if (!filters.status) return;
        const statusArray = filters.status.split(',').map(s => s.trim());
        const nextParamIdx = queryParams.length + 1;
        const placeholders = statusArray.map((_, idx) => `$${nextParamIdx + idx}`).join(', ');
        conditions.push(statusArray.length > 1
          ? `cb.status IN (${placeholders})`
          : `cb.status = $${nextParamIdx}`);
        queryParams.push(...statusArray);
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
    conditionBuilders.status(filters, conditions, queryParams);
    conditionBuilders.pagination(page, pageSize, queryParams, limitcondition);

    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null) return;
      const nextParamIdx = queryParams.length + 1;
      const isMultiValue = typeof value === 'string' && value.includes(',');
      const valueArray = isMultiValue ? value.split(',').map(v => v.trim()) : [value];
      const placeholders = valueArray.map((_, idx) => `$${nextParamIdx + idx}`).join(', ');
      conditions.push(isMultiValue
        ? `cb.${key} IN (${placeholders})`
        : `cb.${key} = $${nextParamIdx}`);
      queryParams.push(...valueArray);
    });

    const tableAlias = 'cb';

    // Filter out unwanted columns
    columns = columns.filter(col => 
      col !== 'merchant_user_id' && 
      col !== 'payin_id' && 
      col !== 'vendor_user_id'
    );

    // Default columns if none provided
    const defaultColumns = ['id', 'payin_id', 'status', 'amount'];
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
    additionalColumns += `
      v.code AS vendor_name,
      p.user AS user
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
