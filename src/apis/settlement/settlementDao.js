import {
  buildInsertQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { tableName } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

const getSettlementDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = []
) => {
  try {
    const { SETTLEMENT, USER, ROLE } = tableName;

    const conditions = [`s.is_obsolete = false`];
    const queryParams = [];
    const limitcondition = { value: '' };

    const handledKeys = new Set(['search', 'sortBy', 'sortOrder', 'role']);

    const conditionBuilders = {
      search: (filters, SETTLEMENT) => {
        if (!filters.search || typeof filters.search !== 'string') return;
        try {
          filters.or = buildSearchFilterObj(filters.search, SETTLEMENT);
          delete filters.search;
        } catch (error) {
          logger.warn(`Invalid search filter: ${filters.search}`, error);
          delete filters.search;
        }
      },
      role: (filters, conditions, queryParams) => {
        if (!filters.role) return;
        const nextParamIdx = queryParams.length + 1;
        conditions.push(`r.role = $${nextParamIdx}`);
        queryParams.push(filters.role);
        delete filters.role;
      },
      pagination: (page, pageSize, queryParams, limitconditionRef) => {
        if (!page || !pageSize) return;
        const nextParamIdx = queryParams.length + 1;
        limitconditionRef.value = `LIMIT $${nextParamIdx} OFFSET $${nextParamIdx + 1}`;
        queryParams.push(pageSize, (page - 1) * pageSize);
      }
    };

    conditionBuilders.search(filters, SETTLEMENT);
    conditionBuilders.role(filters, conditions, queryParams);
    conditionBuilders.pagination(page, pageSize, queryParams, limitcondition);

    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null) return;
      const nextParamIdx = queryParams.length + 1;

      if (Array.isArray(value)) {
        const placeholders = value.map((_, idx) => `$${nextParamIdx + idx}`).join(', ');
        conditions.push(`s.${key} IN (${placeholders})`);
        queryParams.push(...value);
      } else {
        const isMultiValue = typeof value === 'string' && value.includes(',');
        const valueArray = isMultiValue ? value.split(',').map(v => v.trim()) : [value];
        const placeholders = valueArray.map((_, idx) => `$${nextParamIdx + idx}`).join(', ');
        conditions.push(isMultiValue ? `s.${key} IN (${placeholders})` : `s.${key} = $${nextParamIdx}`);
        queryParams.push(...valueArray);
      }
    });

    const columnSelection = columns.length > 0 
      ? columns.map(col => `s.${col}`).join(', ')
      : `s.*`;

    const baseQuery = `
      SELECT DISTINCT ON (s.sno)
        ${columnSelection},
        u.role_id,
        u.designation_id,
        r.role,
        u.id AS user_table_id
      FROM public."${SETTLEMENT}" s
      JOIN public."${USER}" u ON s.user_id = u.id
      LEFT JOIN public."${ROLE}" r ON u.role_id = r.id
      WHERE ${conditions.join(' AND ')}
    `;

    const sortClause = sortBy && sortOrder 
      ? `ORDER BY s.${sortBy} ${sortOrder.toUpperCase()}`
      : 'ORDER BY s.sno DESC';

    const finalQuery = `
      ${baseQuery}
      ${sortClause}
      ${limitcondition.value}
    `;

    console.log('Final Query:', finalQuery); // Debug query
    console.log('Query Params:', queryParams); // Debug params

    const result = await executeQuery(finalQuery, queryParams);
    return result.rows;

  } catch (error) {
    logger.error('Error in getSettlementDao:', error);
    throw error.message;
  }
};
const getSettlementsBySearchDao = async (
  filters,
  searchTerms,
  limitNum,
  offset,
) => {
  try {
    const { USER, SETTLEMENT, ROLE } = tableName;
    const conditions = [];
    const values = [filters.company_id];
    let paramIndex = 2;

    let queryText = `
      SELECT 
        s.id,
        s.user_id,
        s.sno,
        s.company_id,
        s.amount,
        s.status,
        s.config,
        s.method,
        s.created_at,
        s.updated_at,
        u.role_id,
        u.designation_id,
        u.id AS user_table_id,
        u.first_name || ' ' || u.last_name AS full_name,
        r.role AS role_name
      FROM "${SETTLEMENT}" s
      JOIN "${USER}" u ON s.user_id = u.id
      LEFT JOIN "${ROLE}" r ON u.role_id = r.id
      WHERE s.is_obsolete = false 
        AND s.company_id = $1
    `;

    // Handle additional filters
    if (filters.role_name) {
      console.log(filters.role_name, 'filters.role_name');
      queryText += ` AND r.role = $${paramIndex}`;
      values.push(filters.role_name);
      paramIndex++;
    }

    if (filters.status) {
      queryText += ` AND s.status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }

    if (filters && Array.isArray(filters.user_id) && filters.user_id.length > 0) {
      const placeholders = filters.user_id
        .map((_, idx) => `$${paramIndex + idx}`)
        .join(', ');
      queryText += ` AND s.user_id IN (${placeholders})`;
      values.push(...filters.user_id);
      paramIndex += filters.user_id.length;
    }
    
    // Handle search terms
    searchTerms.forEach((term) => {
      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolValue = term.toLowerCase() === 'true';
        conditions.push(`
          (
            s.is_obsolete = $${paramIndex}
          )
        `);
        values.push(boolValue);
        paramIndex++;
      } else {
        conditions.push(`
          (
            LOWER(s.id::text) LIKE LOWER($${paramIndex})
            OR LOWER(s.user_id::text) LIKE LOWER($${paramIndex})
            OR LOWER(s.amount::text) LIKE LOWER($${paramIndex})
            OR LOWER(s.status) LIKE LOWER($${paramIndex})
            OR LOWER(s.method) LIKE LOWER($${paramIndex})
            OR LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER($${paramIndex})
            OR LOWER(r.role) LIKE LOWER($${paramIndex})
            OR LOWER(COALESCE(s.config->>'reference_id', '')) LIKE LOWER($${paramIndex})
            OR LOWER(COALESCE(s.config->>'rejected_reason', '')) LIKE LOWER($${paramIndex})
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
      ORDER BY s.created_at DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    values.push(limitNum, offset);

    // Optional: log for debugging

    const countResult = await executeQuery(countQuery, values.slice(0, -2));
    const searchResult = await executeQuery(queryText, values);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limitNum);

    return {
      totalCount: totalItems,
      totalPages,
      settlements: searchResult.rows,
    };
  } catch (error) {
    logger.error('Error in getSettlementsBySearchDao:', error.message);
    throw error.message;
  }
};

const getSettlementDaoforInternalTransfer = async (utr, method) => {
  try {
    let baseQuery = `SELECT id, user_id, status, amount, method, config, approved_at, rejected_at, created_by, created_at, updated_at, company_id, is_obsolete, updated_by FROM "${tableName.SETTLEMENT}"
 WHERE config->>'reference_id' = $1 AND method = ANY($2)`;

    const queryParams = [utr, method];
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows.length > 0 ? result.rows : result.rows[0];
  } catch (error) {
    console.error(error);
    throw error.message;
  }
};

const createSettlementDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.SETTLEMENT, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error.message;
  }
};

const updateSettlementDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.SETTLEMENT, data, id);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }

    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error.message;
  }
};

const deleteSettlementDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.SETTLEMENT, data, id);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }

    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error.message;
  }
};

export {
  getSettlementDao,
  createSettlementDao,
  getSettlementsBySearchDao,
  getSettlementDaoforInternalTransfer,
  updateSettlementDao,
  deleteSettlementDao,
};
