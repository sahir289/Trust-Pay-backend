import {
  setupIndexWithMappings,
  bulkIndexFromPG,
} from '../../utils/buildElasticSearch.js';
import { logger } from '../../utils/logger.js';


export const payoutMappings = {
  id: { type: 'keyword' },
  sno: { type: 'integer' },
  user: { type: 'keyword' }, 
  merchant_id: { type: 'keyword' },
  vendor_id: { type: 'keyword' },
  bank_acc_id: { type: 'keyword' },
  amount: { type: 'double' },
  status: { type: 'keyword' },
  failed_reason: { type: 'text' },
  currency: { type: 'keyword' },
  merchant_order_id: { type: 'keyword' },
  acc_no: { type: 'keyword', fields: { text: { type: 'text' } } },
  acc_holder_name: { type: 'keyword', fields: { text: { type: 'text' } } },
  ifsc_code: { type: 'keyword', fields: { text: { type: 'text' } } },
  bank_name: { type: 'keyword', fields: { text: { type: 'text' } } },
  upi_id: { type: 'keyword', fields: { text: { type: 'text' } } },
  utr_id: { type: 'keyword' },
  rejected_reason: { type: 'text' },
  payout_merchant_commission: { type: 'double' },
  payout_vendor_commission: { type: 'double' },
  approved_at: { type: 'date' },
  rejected_at: { type: 'date' },
  config: {
    type: 'object'
  },
  created_by: { type: 'keyword' },
  updated_by: { type: 'keyword' },
  created_at: { type: 'date' },
  updated_at: { type: 'date' },
  company_id: { type: 'keyword' },
  is_obsolete: { type: 'boolean' },
  nick_name: { type: 'keyword' },
  bank_user_id: { type: 'keyword' },
  vendor_code: { type: 'keyword' },
  vendor_user_id: { type: 'keyword' },
  merchant_details: {
    type: 'object',
    properties: {
      merchant_code: { type: 'keyword' },
      return_url: { type: 'keyword' },
      notify_url: { type: 'keyword' },
      public_key: { type: 'keyword' },
      private_key: { type: 'keyword' },
    },
  },
  user_bank_details: {
    type: 'object',
    properties: {
      account_holder_name: { type: 'keyword' },
      account_no: { type: 'keyword' },
      ifsc_code: { type: 'keyword' },
      bank_name: { type: 'keyword' },
    },
  },
};
const payoutFields = [
  'id',
  'sno',
  'user',
  'merchant_id',
  'vendor_id',
  'bank_acc_id',
  'amount',
  'status',
  'failed_reason',
  'currency',
  'merchant_order_id',
  'acc_no',
  'acc_holder_name',
  'ifsc_code',
  'bank_name',
  'upi_id',
  'utr_id',
  'rejected_reason',
  'payout_merchant_commission',
  'payout_vendor_commission',
  'approved_at',
  'rejected_at',
  'config',
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
  'company_id',
  'is_obsolete',
  'nick_name',
  'bank_user_id',
  'vendor_code',
'vendor_user_id',
 'merchant_details',
  'user_bank_details',
];


export async function migratePayoutToES() {
  try {
    await setupIndexWithMappings('payouts', payoutMappings, {
      number_of_shards: 5,
      refresh_interval: '30s',
    });

    // Bulk index (filter enabled users only)
    const result = await bulkIndexFromPG(
      'payout_for_es', // Postgres table
      'payouts', // Elasticsearch base index
      payoutFields,
      10000, // Batch size
      '', // Filter condition (modify if needed)
      'id', // Primary key
      'public', // Schema
    );
    logger.info('Payout migration completed:', result);
  } catch (error) {
    logger.error('Payout migration failed:', error.message);
  }
}


migratePayoutToES();