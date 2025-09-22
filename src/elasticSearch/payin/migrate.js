import {
  setupIndexWithMappings,
  bulkIndexFromPG,
} from '../../utils/buildElasticSearch.js';
import { logger } from '../../utils/logger.js';

const userFields = [
  'id',
  'sno',
  'upi_short_code',
  'qr_params',
  'amount',
  'status',
  'is_notified',
  'user_submitted_utr',
  'currency',
  'merchant_order_id',
  'user',
  'bank_acc_id',
  'merchant_id',
  'bank_response_id',
  'payin_merchant_commission',
  'payin_vendor_commission',
  'user_submitted_image',
  'duration',
  'is_url_expires',
  'expiration_date',
  'one_time_used',
  'approved_at',
  'failed_at',
  'payin_details', 
  'created_at',
  'updated_at',
  'company_id',
  'is_obsolete',
  'created_by',
  'updated_by',
  'nick_name',
  'bank_user_id',
  'merchant_details',
  'vendor_code',
  'vendor_user_id',
  'bank_res_details',
];
export const payinMappings = {
  id: { type: 'keyword' },
  sno: { type: 'integer' },
  upi_short_code: { type: 'keyword', fields: { text: { type: 'text' } } },
  qr_params: { type: 'keyword' },
  amount: { type: 'double' },
  status: { type: 'keyword' },
  is_notified: { type: 'boolean' },
  user_submitted_utr: { type: 'keyword', fields: { text: { type: 'text' } } },
  currency: { type: 'keyword' },
  merchant_order_id: { type: 'keyword' },
  user: { type: 'keyword' },
  bank_acc_id: { type: 'keyword' },
  merchant_id: { type: 'keyword' },
  bank_response_id: { type: 'keyword' },
  payin_merchant_commission: { type: 'double' },
  payin_vendor_commission: { type: 'double' },
  user_submitted_image: { type: 'keyword' },
  duration: { type: 'keyword' },
  is_url_expires: { type: 'boolean' },
  expiration_date: { type: 'date' },
  one_time_used: { type: 'boolean' },
  approved_at: { type: 'date' },
  failed_at: { type: 'date' },
  payin_details: {
    type: 'object',
    dynamic: true,
  },
  created_at: { type: 'date' },
  updated_at: { type: 'date' },
  company_id: { type: 'keyword' },
  is_obsolete: { type: 'boolean' },
  created_by: { type: 'keyword' },
  updated_by: { type: 'keyword' },
  nick_name: { type: 'keyword' },
  bank_user_id: { type: 'keyword' },
  merchant_details: {
    type: 'object',
    dynamic: true,
  },
  vendor_code: { type: 'keyword' },
  vendor_user_id: { type: 'keyword' },
  bank_res_details: {
    type: 'object',
    dynamic: true,
  },
};

export async function migratePayinsToES() {
  try {
    await setupIndexWithMappings('payins', payinMappings, {
      number_of_shards: 5,
      refresh_interval: '30s',
    });
    const result = await bulkIndexFromPG(
      'payin_for_es',
      'payins',
      userFields,
      1000, // Reduce batch size for easier debugging
      '',
      'id',
      'public',
    );

    logger.info('Payin migration completed:', result);
  } catch (error) {
    if (
      error.statusCode === 400 &&
      error.message.includes('mapper_parsing_exception')
    ) {
      logger.error(
        'Mapping conflict detected. Check payin_details.user data types. Delete index and retry.',
      );
      // Optionally: Auto-delete and retry logic here
    } else {
      logger.error('Payin migration failed:', {
        message: error.message,
        stack: error.stack,
      });
    }
    throw error;
  }
}

// Execute the migration
migratePayinsToES();
