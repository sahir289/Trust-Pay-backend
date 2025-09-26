import {
  setupIndexWithMappings,
  bulkIndexFromPG,
} from '../../utils/buildElasticSearch.js';
import { logger } from '../../utils/logger.js';

// Fields to migrate (including joined data for UI)
const userFields = [
  'id',
  'role_id',
  'designation_id',
  'first_name',
  'last_name',
  'full_name',
  'email',
  'contact_no',
  'user_name',
  'code',
  'is_enabled',
  'last_login',
  'last_logout',
  'config',
  'designation',
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
];

// Mappings for ElasticSearch
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
  last_login: { type: 'date' },
  last_logout: { type: 'date' },
  config: { type: 'object' },
  designation: { type: 'text' },
  created_by: { type: 'text' },
  updated_by: { type: 'text' },
  created_at: { type: 'date' },
  updated_at: { type: 'date' },
};

// Final migration function
export async function migrateUsersToES() {
  try {
    // 1️⃣ Setup Elastic index
    await setupIndexWithMappings('users', userMappings, {
      number_of_shards: 5,
      refresh_interval: '30s',
    });

    // 2️⃣ Migrate data from Postgres view (joins already included in view)
    // View must be created in Postgres: public.user_for_es
    const result = await bulkIndexFromPG(
      'user_for_es', // View name containing joins
      'users', // Elastic index
      userFields,
      10000, // Batch size
      '', // Optional filter
      'id', // ID field
      'public', // Schema
    );

    logger.info('Users migration completed:', result);
  } catch (error) {
    logger.error('Users migration failed:', error.message);
    throw error;
  }
}

// migrateUsersToES(); // Uncomment to run

migrateUsersToES(); // Uncomment to run
