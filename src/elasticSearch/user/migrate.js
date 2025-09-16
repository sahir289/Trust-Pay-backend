import { setupIndexWithMappings, bulkIndexFromPG } from '../../utils/buildElasticSearch.js';
import { logger } from '../../utils/logger.js';

const userFields = [
  'id', 'role_id', 'designation_id', 'first_name', 'last_name', 'full_name',
  'email', 'contact_no', 'user_name', 'code', 'is_enabled', 'created_by',
  'updated_by', 'designation', 'created_at', 'updated_at', 'company_id'
];

const userMappings = {
  id: { type: 'keyword' },
  role_id: { type: 'keyword' },
  designation_id: { type: 'keyword' },
  first_name: { type: 'text' },
  last_name: { type: 'text' },
  full_name: { type: 'text' },
  email: { type: 'keyword', fields: { text: { type: 'text' } } },
  contact_no: { type: 'keyword', fields: { text: { type: 'text' } } },
  user_name: { type: 'keyword', fields: { text: { type: 'text' } } },
  code: { type: 'keyword', fields: { text: { type: 'text' } } },
  is_enabled: { type: 'boolean' },
  created_by: { type: 'keyword' },
  updated_by: { type: 'keyword' },
  designation: { type: 'text' },
  created_at: { type: 'date' },
  updated_at: { type: 'date' }
};

export async function migrateUsersToES() {
  try {
    await setupIndexWithMappings('users', userMappings, { number_of_shards: 5, refresh_interval: '30s' });

    // Bulk index (filter enabled users only)
    const result = await bulkIndexFromPG(
      'User', // Postgres table
      'users', // Elastic Search base index
      userFields,
      10000, // Batch size
      '', 
      'id',
      'public'
    );
    logger.info('Users migration completed:', result);
  } catch (error) {
    logger.error('Users migration failed:', error.message);
  }
}

// migrateUsersToES();