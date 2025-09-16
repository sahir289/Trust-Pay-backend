import config from '../config/config.js';
import getESClient from '../utils/elasticClient.js';
import { BadRequestError } from './appErrors.js';
import { createPool } from './db.js';
import { logger } from './logger.js';

const readerPool = createPool(config?.databaseReaderUrl, 'Reader');

export const buildESQuery = (
  searchQuery,
  filters = {},
  searchableFields = [],
  offset = 0,
  limit = 20,
) => {
  const queryBody = {
    query: {
      bool: {
        must: [],
        filter: [],
      },
    },
    from: offset,
    size: limit,
    sort: [{ created_at: 'desc' }],
  };

  // Add multi_match only if searchQuery is provided
  if (searchQuery) {
    queryBody.query.bool.must.push({
      multi_match: {
        query: searchQuery, // like "code user_name" or "UTR12345"
        fields: searchableFields, // module-specific fields like (['full_name^2', 'user_name']) here Boost full_name
        operator: 'or', // it matches any term you can change to 'and' for stricter matching
        type: 'best_fields', // it scores based on best-matching field
        lenient: true, // Ignores parse errors for numerics
      },
    });
  }

  // handles term filters (like:- is_enabled: 'true') and date ranges (like:- created_at_start/end)
  Object.entries(filters).forEach(([key, value]) => {
    if (key.endsWith('_start') || key.endsWith('_end')) {
      // handle date range filters (like:- created_at_start, created_at_end -> range on 'created_at') we can use this in future if needed
      const field = key.replace(/_start|_end$/, '');
      const rangeFilter = queryBody.query.bool.filter.find(
        (f) => f.range && f.range[field],
      );
      if (!rangeFilter) {
        queryBody.query.bool.filter.push({ range: { [field]: {} } });
      }
      const newRange = queryBody.query.bool.filter.find(
        (f) => f.range && f.range[field],
      ).range[field];
      if (key.endsWith('_start')) newRange.gte = value; // here greater than or equal
      if (key.endsWith('_end')) newRange.lte = value; // less than or equal
    } else {
      // this is default to term filter for exact matches (like:- is_enabled: 'true', status: 'active')
      queryBody.query.bool.filter.push({ term: { [key]: value } });
    }
  });

  // If no must clauses, add match_all for pure filtering/pagination
  if (queryBody.query.bool.must.length === 0) {
    queryBody.query.bool.must.push({ match_all: {} });
  }
  return queryBody;
};

export const buildInES = async (reqId, reqData, indexName) => {
  try {
    const esClient = await getESClient();
    if (!reqId || !reqData.id)
      throw new BadRequestError('User object must have an id');
    const data = await esClient.index({
      index: indexName,
      id: reqId.toString(), // convert ID to string (Elasticsearch IDs are strings)
      document: reqData, // use filtered object
    });
    return data;
  } catch (error) {
    logger.error('Error updating document in Elasticsearch:', error);
    throw error;
  }
};

export const deleteInES = async (id, indexName) => {
  try {
    const esClient = await getESClient();
    const data = await esClient.delete({
      index: indexName,
      id: id.toString(),
    });
    return data;
  } catch (error) {
    logger.error('Error deleting document in Elasticsearch:', error);
    throw error;
  }
};

export const getIndexName = (baseIndex) => {
  const prefix = config.elasticSearch.indexPrefix;
  return prefix ? `${prefix}_${baseIndex}` : baseIndex;
};

// Setup index with mappings
export const setupIndexWithMappings = async (
  indexBaseName,
  mappings,
  settings = {},
) => {
  const indexName = indexBaseName;
  const esClient = await getESClient();

  try {
    const exists = await esClient.indices.exists({ index: indexName });
    if (!exists) {
      await esClient.indices.create({
        index: indexName,
        body: {
          settings: {
            number_of_shards: 5,
            number_of_replicas: 1,
            ...settings,
          },
          mappings: {
            properties: mappings,
          },
        },
      });
      logger.info(`Created index: ${indexName}`);
    } else {
      // Update mappings if index exists (note: can't change existing fields; add new ones)
      await esClient.indices.putMapping({
        index: indexName,
        body: { properties: mappings },
      });
      logger.info(`Updated mappings for index: ${indexName}`);
    }
    return { success: true, index: indexName };
  } catch (error) {
    logger.error(`Error setting up index ${indexName}:`, error);
    throw error;
  }
};

// Bulk index from PostgreSQL
export const bulkIndexFromPG = async (
  tableName,
  indexBaseName,
  fields,
  batchSize = 10000,
  whereClause = '',
  idField = 'id',
  schema = 'public'
) => {
  const indexName = indexBaseName;
  const esClient = await getESClient();

  // Use reader pool for SELECT (read-only)
  const pool = readerPool;
  const client = await pool.connect();

  try {
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      )`;
    const tableCheck = await pool.query(checkTableQuery, [schema, tableName]);
    if (!tableCheck.rows[0].exists) {
      throw new BadRequestError(`Table ${schema}.${tableName} does not exist`);
    }
    logger.info(`Confirmed table exists: ${schema}.${tableName}`);
    // get total count for progress tracking
    const countQuery = `SELECT COUNT(*) FROM ${tableName} ${whereClause}`;
    const countResult = await pool.query(countQuery); // use pool directly for count
    const totalRecords = parseInt(countResult.rows[0].count);
    if (totalRecords === 0) {
      logger.info(`No records to index from table ${tableName}`);
      return { success: true, indexed: 0 };
    }
    logger.info(`Total records to index from ${tableName}: ${totalRecords}`);

    let offset = 0;
    let indexedCount = 0;

    while (offset < totalRecords) {
      logger.info(
        `Indexing batch from ${tableName}: ${offset} to ${offset + batchSize}`,
      );

      const selectFields = fields.join(', ');
      const batchQuery = `
        SELECT ${selectFields}
        FROM ${tableName}
        ${whereClause}
        ORDER BY ${idField}
        OFFSET $1 LIMIT $2
      `;
      const res = await pool.query(batchQuery, [offset, batchSize]);

      if (res.rows.length === 0) break;

      // Prepare bulk operations
      const bulkBody = res.rows.flatMap((row) => [
        { index: { _index: indexName, _id: row[idField]?.toString() } },
        {
          ...row,
          created_at: row.created_at ? row.created_at.toISOString() : null,
          updated_at: row.updated_at ? row.updated_at.toISOString() : null,
        },
      ]);

      // Execute bulk index
      const bulkResult = await esClient.bulk({ body: bulkBody });

      // Check for errors
      if (bulkResult.body.errors) {
        const failedItems = bulkResult.body.items.filter(
          (item) => item.index?.error,
        );
        logger.error(
          `Bulk indexing errors for ${failedItems.length} items in table ${tableName}:`,
          failedItems,
        );
        throw new BadRequestError(
          'Bulk indexing failed; check logs for details',
        );
      }

      indexedCount += res.rows.length;
      logger.info(
        `Indexed ${indexedCount}/${totalRecords} records from ${tableName}`,
      );
      offset += batchSize;
    }

    // here refresh index to make documents searchable
    await esClient.indices.refresh({ index: indexName });
    logger.info(
      `Bulk indexing completed for table ${tableName} to index ${indexName}`,
    );
    return { success: true, indexed: indexedCount };
  } catch (error) {
    logger.error(`Bulk indexing error for table ${tableName}:`, error);
    throw error;
  } finally {
    client.release();
  }
};
