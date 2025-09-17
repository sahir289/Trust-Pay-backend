import { setupIndexWithMappings, bulkIndexFromPG } from '../../utils/buildElasticSearch.js';
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
  'config',
  'created_at',
  'updated_at',
  'company_id',
  'is_obsolete',
  'created_by',
  'updated_by',
];
export const payinMappings = {
    id: { type: 'keyword' },
    sno: { type: 'integer' },
    upi_short_code: { type: 'keyword', fields: { text: { type: 'text' } } },
    qr_params: { type: 'keyword' }, // or text if searchable
    amount: { type: 'double' }, // align with table's double precision
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
    config: { type: 'object' },
    created_at: { type: 'date' },
    updated_at: { type: 'date' },
    company_id: { type: 'keyword' },
    is_obsolete: { type: 'boolean' },
    created_by: { type: 'keyword' },
    updated_by: { type: 'keyword' },
};
  
  

export async function migrateBankResponseToES() {
  try {
    await setupIndexWithMappings('payins', payinMappings, {
      number_of_shards: 5,
      refresh_interval: '30s',
    });

    // Bulk index (filter enabled users only)
    const result = await bulkIndexFromPG(
      'Payin', // Postgres table
      'payins', // Elastic Search base index
      userFields,
      10000, // Batch size
      '', 
      'id',
      'public'
    );
    logger.info('Payin migration completed:', result);
  } catch (error) {
    logger.error('Payin migration failed:', error.message);
  }
}

// migrateUsersToES();