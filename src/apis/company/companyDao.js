import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
  buildAndExecuteUpdateQuery,
} from '../../utils/db.js';
import { tableName } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';

const getCompanyDao = async (filters, page, pageSize, sortBy, sortOrder) => {
  try {
    const baseQuery = `SELECT id,first_name,last_name,config FROM "${tableName.COMPANY}" WHERE 1=1`;
    //TODO: columns.Company dynamic search
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
    );
    const result = await executeQuery(sql, queryParams);
    return result.rows.length > 0 ? result.rows : result.rows[0];
  } catch (error) {
    logger.error('Error fetching company:', error);
    throw error;
  }
};

const getCompanyBySearchDao = async (
  filters,
  searchTerms,
  pageNumber = 1,
  pageSize = 10,
) => {
  try {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    const validatedPageSize = Math.min(
      Math.max(parseInt(pageSize) || 10, 1),
      100,
    ); // Enforce 1-100 limit
    const validatedPageNumber = Math.max(parseInt(pageNumber) || 1);
    const offset = (validatedPageNumber - 1) * validatedPageSize;

    // TODO: Implement role-based query filtering if needed in future
    let queryText = `
      SELECT 
        "Company".id,
        "Company".first_name,
        "Company".last_name,
        "Company".email,
        "Company".contact_no,
        (
          SELECT json_object_agg(key, value)
          FROM json_each("Company".config) 
          WHERE key NOT IN ('created_by', 'updated_by', 'authorized', 'is_enabled')
        ) AS config,
        "Company".created_at,
        "Company".updated_at,
        "Company".first_name || ' ' || "Company".last_name AS company_name,
        COALESCE("Company".config->>'created_by', '') AS created_by,
        COALESCE("Company".config->>'updated_by', '') AS updated_by,
        COALESCE(("Company".config->>'authorized')::boolean, false) AS authorized,
        COALESCE(("Company".config->>'is_enabled')::boolean, true) AS is_enabled
      FROM "Company"
      WHERE 1=1 
        AND "Company".is_obsolete = false 
    `;

    // Add id filter
    if (filters.id) {
      if (Array.isArray(filters.id)) {
        const placeholders = filters.id
          .map((_, i) => `$${paramIndex + i}`)
          .join(', ');
        queryText += ` AND "Company"."id" IN (${placeholders})`;
        values.push(...filters.id);
        paramIndex += filters.id.length;
      } else {
        queryText += ` AND "Company"."id" = $${paramIndex}`;
        values.push(filters.id);
        paramIndex++;
      }
    }

    if (searchTerms) {
      searchTerms.forEach((term) => {
        if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
          const boolValue = term.toLowerCase() === 'true';
          conditions.push(`"Company".is_enabled = $${paramIndex}`);
          values.push(boolValue);
          paramIndex++;
        } else {
          conditions.push(`
            (
              LOWER("Company".id::text) LIKE LOWER($${paramIndex})
              OR LOWER("Company".first_name) LIKE LOWER($${paramIndex})
              OR LOWER("Company".last_name) LIKE LOWER($${paramIndex})
              OR LOWER("Company".email) LIKE LOWER($${paramIndex})
              OR LOWER("Company".contact_no) LIKE LOWER($${paramIndex})
              OR LOWER("Company".created_by::text) LIKE LOWER($${paramIndex})
              OR LOWER("Company".updated_by::text) LIKE LOWER($${paramIndex})
              OR LOWER("Company".first_name || ' ' || "Company".last_name) LIKE LOWER($${paramIndex})
            )
          `);
          values.push(`%${term}%`);
          paramIndex++;
        }
      });
    }

    if (conditions.length > 0) {
      queryText += ' AND (' + conditions.join(' OR ') + ')';
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${queryText}) as count_table`;
    const countResult = await executeQuery(countQuery, values);

    queryText += `
      ORDER BY "Company"."updated_at" DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    values.push(validatedPageSize, offset);

    let searchResult = await executeQuery(queryText, values);
    const totalItems = parseInt(countResult.rows[0].total);
    let totalPages = Math.ceil(totalItems / validatedPageSize);
    if (totalItems > 0 && searchResult.rows.length === 0 && offset > 0) {
      values[values.length - 1] = 0;
      searchResult = await executeQuery(queryText, values);
      totalPages = Math.ceil(totalItems / validatedPageSize);
    }

    const data = {
      totalCount: totalItems,
      totalPages,
      companies: searchResult.rows,
    };
    return data;
  } catch (error) {
    logger.error(error.message);
    throw error;
  }
};

const getCompanyNamesDao = async () => {
  try {
    const baseQuery = `SELECT id, first_name, last_name FROM "${tableName.COMPANY}" WHERE 1=1`;
    //TODO: columns.Company dynamic search
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      {},
      null,
      null,
      "first_name || ' ' || last_name",
      'ASC',
    );
    const result = await executeQuery(sql, queryParams);
    return result.rows.length > 0 ? result.rows : result.rows[0];
  } catch (error) {
    logger.error('Error fetching company:', error);
    throw error;
  }
};
const getCompanyDetailsByIdDao = async (id) => {
  try {
    const baseQuery = `SELECT CONCAT(first_name, ' ', last_name) AS full_name, config ->> 'allowPayAssist' AS allowPayAssist, config ->> 'allowTataPay' AS allowTataPay FROM "${tableName.COMPANY}" WHERE 1 = 1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, id);
    const result = await executeQuery(sql, queryParams);
    return result.rows.length > 0 ? result.rows : result.rows[0];
  } catch (error) {
    logger.error('Error fetching company details by ID:', error);
    throw error;
  }
};

const getCashfreeAllowByCompanyIdDao = async (id) => {
  try {
    const sql = `
      SELECT 
        CONCAT(first_name, ' ', last_name) AS full_name, 
        COALESCE((config ->> 'allow_cashfree')::boolean, false) AS allow_cashfree,
        COALESCE((config ->> 'allow_zentechind')::boolean, false) AS allow_zentechind
      FROM "${tableName.COMPANY}"
      WHERE id = $1
    `
    const queryParams = [id];
    const result = await executeQuery(sql, queryParams);
    return result.rows[0];
  } catch (error) {
    logger.error('Error fetching company details by ID:', error);
    throw error;
  }
};

const getCompanyByIDDao = async (filters) => {
  try {
    const baseQuery = `SELECT id,config FROM "${tableName.COMPANY}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, filters);
    const result = await executeQuery(sql, queryParams);
    return result.rows.length > 0 ? result.rows : result.rows[0];
  } catch (error) {
    logger.error('Error fetching company:', error);
    throw error;
  }
};

const createCompanyDao = async (conn, payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.COMPANY, payload);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching company:', error);
    throw error;
  }
};

const updateCompanyDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.COMPANY, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating company:', error); // Log the error for debugging
    throw error;
  }
};
const updateCompanyConfigDao = async (id, data, conn) => {
  return await buildAndExecuteUpdateQuery(
    tableName.COMPANY,
    data,
    id,
    {},
    { returnUpdated: true },
    conn,
  );
};

const deleteCompanyDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.COMPANY, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error deleting company:', error); // Log the error for debugging
    throw error;
  }
};

export {
  getCompanyDao,
  createCompanyDao,
  updateCompanyDao,
  deleteCompanyDao,
  getCompanyByIDDao,
  getCashfreeAllowByCompanyIdDao,
  updateCompanyConfigDao,
  getCompanyDetailsByIdDao,
  getCompanyNamesDao,
  getCompanyBySearchDao,
};
