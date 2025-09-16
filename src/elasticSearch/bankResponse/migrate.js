import { setupIndexWithMappings, bulkIndexFromPG } from '../../utils/buildElasticSearch.js';
import { logger } from '../../utils/logger.js';

const userFields = [
  'id',
  'sno',
  'status',
  'bank_id',
  'amount',
  'upi_short_code',
  'utr',
  'is_used',
  'nick_name',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'company_id',
  'is_obsolete',
  'config',
];

export const bankResponseMappings = {
    id: { type: 'keyword' },
    sno: { type: 'integer' },
    status: { type: 'keyword'},
    bank_id: { type: 'keyword' },
    nick_name: { type: 'keyword', fields: { text: { type: 'text' } } },
    amount: { type: 'integer' },
    upi_short_code: { type: 'keyword', fields: { text: { type: 'text' } } },
    utr: { type: 'keyword', fields: { text: { type: 'text' } } },
    is_used: { type: 'boolean' },
    created_at: { type: 'date' },
    updated_at: { type: 'date' },
    created_by: { type: 'keyword' },
    updated_by: { type: 'keyword' },
    company_id: { type: 'keyword' },
    is_obsolete: { type: 'boolean' },
    config: { type: 'object' },
  };
  
  

export async function migrateBankResponseToES() {
  try {
    await setupIndexWithMappings('bankresponse', bankResponseMappings, {
      number_of_shards: 5,
      refresh_interval: '30s',
    });

    // Bulk index (filter enabled users only)
    const result = await bulkIndexFromPG(
      'BankResponse', // Postgres table
      'bankresponse', // Elastic Search base index
      userFields,
      10000, // Batch size
      '', 
      'id',
      'public'
    );
    logger.info('Bank Response migration completed:', result);
  } catch (error) {
    logger.error('Bank Response migration failed:', error.message);
  }
}

// migrateUsersToES();