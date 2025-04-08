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
      const isMultiValue = typeof value === 'string' && value.includes(',');
      const valueArray = isMultiValue ? value.split(',').map(v => v.trim()) : [value];
      const placeholders = valueArray.map((_, idx) => `$${nextParamIdx + idx}`).join(', ');
      conditions.push(isMultiValue
        ? `s.${key} IN (${placeholders})`
        : `s.${key} = $${nextParamIdx}`);
      queryParams.push(...valueArray);
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
// const settlementJoindao = async (
//   baseTable,
//   filters,
//   page,
//   pageSize,
//   sortBy,
//   sortOrder,
//   columns = [],
// ) => {
//   const baseQuery = `SELECT ${columns.length ? columns.join(', ') : "*"} FROM "${tableName.MERCHANT}" WHERE 1=1`;
//   const [sql, queryParams] = await buildJoinQuery(baseTable, filters, baseQuery, page, pageSize, sortBy, sortOrder);
//   const result = await executeQuery(sql, queryParams);
//   return result.rows;
// };

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
  getSettlementDaoforInternalTransfer,
  updateSettlementDao,
  deleteSettlementDao,
};
