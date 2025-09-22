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
  sno: { type: 'long' },
  status: { type: 'keyword' },
  bank_id: { type: 'keyword' },
  nick_name: { type: 'keyword', fields: { text: { type: 'text' } } },
  amount: { type: 'long' },
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
  bank_user_id: { type: 'keyword' },
  vendor_code: { type: 'keyword' },
};

  
  

  export async function migrateBankResponseToES() {
    try {
      await setupIndexWithMappings('bankresponse', bankResponseMappings, {
        number_of_shards: 5,
        refresh_interval: '30s',
      });

      // Bulk index from the view (joined data)
      const result = await bulkIndexFromPG(
        'bankresponse_for_es', // ← use the view instead of raw table
        'bankresponse', // Elastic index
        userFields, // Columns to index
        10000, // Batch size
        '',
        'id', // Primary key
        'public', // Schema
      );

      logger.info('Bank Response migration completed:', result);
    } catch (error) {
      logger.error('Bank Response migration failed:', error.message);
    }
  }
  

  migrateBankResponseToES();