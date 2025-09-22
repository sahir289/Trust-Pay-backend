// settlementElasticMigration.js

import {
  setupIndexWithMappings,
  bulkIndexFromPG,
} from '../../utils/buildElasticSearch.js';
import { logger } from '../../utils/logger.js';


const settlementFields = [
  'id',
  'sno',
  'user_id',
  'user_name',
  'role_name',
  'role',
  'status',
  'amount',
  'method',
  'bank_name',
  'acc_holder_name',
  'acc_no',
  'ifsc',
  'code',
  'created_by',
  'updated_by',
  'config',
  'approved_at',
  'rejected_at',
  'created_at',
  'updated_at',
  'company_id',
  'is_obsolete',
];

export const settlementMappings = {
  id: { type: 'keyword' },
  sno: { type: 'integer' },
  user_id: { type: 'keyword' },
  user_name: { type: 'text' },
  role_name: { type: 'keyword' },
  role: { type: 'keyword' },
  status: { type: 'keyword', fields: { text: { type: 'text' } } },
  amount: { type: 'double' },
  method: { type: 'keyword', fields: { text: { type: 'text' } } },
  bank_name: { type: 'text' },
  acc_holder_name: { type: 'text' },
  acc_no: { type: 'keyword' },
  ifsc: { type: 'keyword' },
  merchant_code: { type: 'keyword' },
  vendor_code: { type: 'keyword' },
  code: { type: 'keyword' },
  created_by: { type: 'keyword' },
  updated_by: { type: 'keyword' },
  config: {
    type: 'object',
    properties: {
      acc_no: { type: 'keyword' },
    },
  },
  approved_at: { type: 'date' },
  rejected_at: { type: 'date' },
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
    const result = await bulkIndexFromPG(
      'settlement_es_view',
      'settlements',
      settlementFields,
      10000,
      '', 
      'id',
      'public',
    );
    logger.info('Settlement migration with joins completed:', result);
  } catch (error) {
    logger.error('Settlement migration failed:', error.message);
  }
}


migrateSettlementToES() 