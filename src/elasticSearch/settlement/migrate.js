import {
  setupIndexWithMappings,
  bulkIndexFromPG,
} from '../../utils/buildElasticSearch.js';
import { logger } from '../../utils/logger.js';

const settlementFields = [
  'id',
  'sno',
  'user_id',
  'status',
  'amount',
  'method',
  'config',
  'approved_at',
  'rejected_at',
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
  'company_id',
  'is_obsolete',
];

export const settlementMappings = {
  id: { type: 'keyword' },
  sno: { type: 'integer' },
  user_id: { type: 'keyword' },
  status: { type: 'keyword', fields: { text: { type: 'text' } } },
  amount: { type: 'double' },
  method: { type: 'keyword', fields: { text: { type: 'text' } } },
  config: { type: 'object' },
  approved_at: { type: 'date' },
  rejected_at: { type: 'date' },
  created_by: { type: 'keyword' },
  updated_by: { type: 'keyword' },
  created_at: { type: 'date' },
  updated_at: { type: 'date' },
  company_id: { type: 'keyword' },
  is_obsolete: { type: 'boolean' },
};

export async function migrateSettlementToES() {
  try {
    await setupIndexWithMappings('settlements', settlementMappings, {
      number_of_shards: 5,
      refresh_interval: '30s',
    });

    // Bulk index
    const result = await bulkIndexFromPG(
      'Settlement', // Postgres table
      'settlements', // Elasticsearch base index
      settlementFields,
      10000, // Batch size
      '', // Filter condition (modify if needed)
      'id', // Primary key
      'public', // Schema
    );
    logger.info('Settlement migration completed:', result);
  } catch (error) {
    logger.error('Settlement migration failed:', error.message);
  }
}
