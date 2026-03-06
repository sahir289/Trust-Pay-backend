import config from '../config/config.js';
import getESClient from '../utils/elasticClient.js';
import { BadRequestError } from './appErrors.js';
import { getConnection } from './db.js';
import { logger } from './logger.js';

export const buildESQuery = (
  searchQuery,
  filters = {},
  searchableFields = [],
  offset = 0,
  limit = 20,
  sortBy = 'created_at',
  sortOrder = 'desc',
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
    sort: [{ [sortBy]: sortOrder }],
  };
  if (searchQuery) {
    queryBody.query.bool.must.push({
      multi_match: {
        query: searchQuery,
        fields: searchableFields,
        operator: 'and',
        type: 'best_fields',
        lenient: true,
      },
    });
  }

  // Filters
  Object.entries(filters).forEach(([key, value]) => {
    if (key === 'updated_at') {
      const [day, month, year] = value.split('-');
      const formattedDate = `${year}-${month}-${day}`; 
      queryBody.query.bool.filter.push({
        range: {
          updated_at: {
            gte: `${formattedDate}T00:00:00.000Z`,
            lte: `${formattedDate}T23:59:59.999Z`,
          },
        },
      });
    }
    // else if (key.endsWith('_start') || key.endsWith('_end')) {
    //   const field = key.replace(/_start|_end$/, '');
    //   const rangeFilter = queryBody.query.bool.filter.find(
    //     (f) => f.range && f.range[field],
    //   );
    //   if (!rangeFilter) {
    //     queryBody.query.bool.filter.push({ range: { [field]: {} } });
    //   }
    //   const newRange = queryBody.query.bool.filter.find(
    //     (f) => f.range && f.range[field],
    //   ).range[field];
    //   if (key.endsWith('_start')) newRange.gte = value;
    //   if (key.endsWith('_end')) newRange.lte = value;
    // }
    else {
        if (typeof value === 'string' && value.includes(',')) {
          const values = value.split(',').map((v) => v.trim());
      
          if (key === 'status') {
            queryBody.query.bool.filter.push({
              bool: {
                should: values.map((v) => ({
                  match: {
                    [key]: {
                      query: v,
                      operator: 'and',
                      lenient: true,
                    },
                  },
                })),
                minimum_should_match: 1,
              },
            });
          } else {
            queryBody.query.bool.filter.push({
              terms: {
                [key]: values,
              },
            });
          }
        } else if (typeof value === 'string') {
          queryBody.query.bool.filter.push({
            match: {
              [key]: {
                query: value,
                operator: 'and',
                lenient: true,
              },
            },
          });
        } else if (Array.isArray(value)) {
          queryBody.query.bool.filter.push({
            terms: {
              [key]: value,
            },
          });
        } else {
          queryBody.query.bool.filter.push({ term: { [key]: value } });
        }
    }
  });

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
export const updateInES = async (id, indexName, updateData) => {
  try {
    const esClient = await getESClient();
    if (!id) throw new BadRequestError('Document ID is required');
    if (!updateData || Object.keys(updateData).length === 0) {
      throw new BadRequestError('Update data cannot be empty');
    }

    const data = await esClient.update({
      index: indexName,
      id: id.toString(), // Convert ID to string (Elasticsearch IDs are strings)
      body: {
        doc: updateData, // Partial update data
      },
    });

    // Refresh index to make the updated document searchable immediately
    await esClient.indices.refresh({ index: indexName });
    logger.info(`Updated document with ID ${id} in index ${indexName}`);
    return data;
  } catch (error) {
    logger.error(
      `Error updating document with ID ${id} in Elasticsearch:`,
      error,
    );
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
  schema = 'public',
) => {
  const indexName = indexBaseName;
  const esClient = await getESClient();

  const client = await getConnection('reader');

  try {
    // 1️⃣ Check table/view exists
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      )
    `;
    const tableCheck = await client.query(checkTableQuery, [schema, tableName]);
    if (!tableCheck.rows[0].exists) {
      throw new BadRequestError(
        `Table or view ${schema}.${tableName} does not exist`,
      );
    }
    logger.info(`Confirmed table/view exists: ${schema}.${tableName}`);

    // 2️⃣ Get total count
    const countQuery = `SELECT COUNT(*) FROM ${tableName} ${whereClause}`;
    const countResult = await client.query(countQuery);
    const totalRecords = parseInt(countResult.rows[0].count);
    if (totalRecords === 0) {
      logger.info(`No records to index from ${tableName}`);
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
      const res = await client.query(batchQuery, [offset, batchSize]);

      if (res.rows.length === 0) break;

      // 3️⃣ Prepare bulk operations
      const bulkBody = res.rows.flatMap((row) => [
        { index: { _index: indexName, _id: row[idField]?.toString() } },
        {
          ...row,
          created_at: row.created_at ? row.created_at.toISOString() : null,
          updated_at: row.updated_at ? row.updated_at.toISOString() : null,
        },
      ]);

      // 4️⃣ Execute bulk index
      const bulkResult = await esClient.bulk({ body: bulkBody });

      // 5️⃣ v8+ compatible error check
      const errorsExist =
        bulkResult.errors || (bulkResult.body && bulkResult.body.errors);
      if (errorsExist) {
        const failedItems = (
          bulkResult.items ||
          bulkResult.body?.items ||
          []
        ).filter((item) => item.index?.error);
        logger.error(
          `Bulk indexing errors for ${failedItems.length} items in ${tableName}:`,
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

    // 6️⃣ Refresh index
    await esClient.indices.refresh({ index: indexName });
    logger.info(
      `Bulk indexing completed for ${tableName} → index ${indexName}`,
    );
    return { success: true, indexed: indexedCount };
  } catch (error) {
    logger.error(`Bulk indexing error for ${tableName}:`, error);
    throw error;
  } finally {
    client.release();
  }
};
