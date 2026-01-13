/**
 * EXAMPLE: How to Add Caching to Your Endpoints
 * 
 * This file shows examples of adding caching to common patterns in your app.
 * Copy these patterns to your actual DAO files.
 */

import withCache, { CacheTTL, invalidateCache } from '../utils/cache.js';
import { executeQuery } from '../utils/db.js';

// ============================================================================
// EXAMPLE 1: Simple List Query with Caching
// ============================================================================

export const getMerchantsListCached = async (companyId, filters) => {
  return await withCache(
    `merchants:list:${companyId}:${JSON.stringify(filters)}`,
    async () => {
      const result = await executeQuery(
        'SELECT * FROM merchants WHERE company_id = $1 AND is_obsolete = false',
        [companyId]
      );
      return result.rows;
    },
    CacheTTL.FIVE_MINUTES // Cache for 5 minutes
  );
};

// ============================================================================
// EXAMPLE 2: Single Record with Cache
// ============================================================================

export const getMerchantByIdCached = async (merchantId) => {
  return await withCache(
    `merchant:${merchantId}`,
    async () => {
      const result = await executeQuery(
        'SELECT * FROM merchants WHERE id = $1',
        [merchantId]
      );
      return result.rows[0];
    },
    CacheTTL.TEN_MINUTES // Cache for 10 minutes
  );
};

// ============================================================================
// EXAMPLE 3: Complex Query with Multiple Filters (Auto-Hash Key)
// ============================================================================

export const getBankResponsesCached = async (filters) => {
  return await withCache(
    { filters }, // Pass object - will auto-generate hash key
    async () => {
      const [query, params] = buildSelectQuery(
        'SELECT * FROM bank_responses',
        filters,
        1, 20, 'created_at', 'DESC'
      );
      const result = await executeQuery(query, params);
      return result.rows;
    },
    CacheTTL.ONE_MINUTE, // 1 minute for real-time data
    'bank_responses' // Cache key prefix
  );
};

// ============================================================================
// EXAMPLE 4: Write Operation with Cache Invalidation
// ============================================================================

export const updateMerchantCached = async (merchantId, data) => {
  // Perform update
  const result = await executeQuery(
    'UPDATE merchants SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [data.name, merchantId]
  );

  // Invalidate related caches
  await invalidateCache(`merchant:${merchantId}`); // Single merchant
  await invalidateCache('merchants:list:*'); // All merchant lists

  return result.rows[0];
};

// ============================================================================
// EXAMPLE 5: Dashboard/Stats Query (Frequently Accessed)
// ============================================================================

export const getDashboardStatsCached = async (companyId, dateRange) => {
  return await withCache(
    `dashboard:stats:${companyId}:${dateRange.start}:${dateRange.end}`,
    async () => {
      const result = await executeQuery(`
        SELECT 
          COUNT(*) as total_transactions,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount
        FROM transactions
        WHERE company_id = $1 
          AND created_at BETWEEN $2 AND $3
      `, [companyId, dateRange.start, dateRange.end]);
      return result.rows[0];
    },
    CacheTTL.FIVE_MINUTES // Refresh stats every 5 minutes
  );
};

// ============================================================================
// EXAMPLE 6: Paginated Query with Cache
// ============================================================================

export const getPaginatedMerchantsCached = async (companyId, page, limit) => {
  return await withCache(
    `merchants:paginated:${companyId}:${page}:${limit}`,
    async () => {
      const offset = (page - 1) * limit;
      const result = await executeQuery(
        'SELECT * FROM merchants WHERE company_id = $1 LIMIT $2 OFFSET $3',
        [companyId, limit, offset]
      );
      
      const countResult = await executeQuery(
        'SELECT COUNT(*) as total FROM merchants WHERE company_id = $1',
        [companyId]
      );

      return {
        data: result.rows,
        total: parseInt(countResult.rows[0].total),
        page,
        limit,
        totalPages: Math.ceil(countResult.rows[0].total / limit)
      };
    },
    CacheTTL.FIVE_MINUTES
  );
};

// ============================================================================
// EXAMPLE 7: Settings/Configuration (Long Cache)
// ============================================================================

export const getCompanySettingsCached = async (companyId) => {
  return await withCache(
    `company:settings:${companyId}`,
    async () => {
      const result = await executeQuery(
        'SELECT config FROM companies WHERE id = $1',
        [companyId]
      );
      return result.rows[0]?.config || {};
    },
    CacheTTL.THIRTY_MINUTES // Settings don't change often
  );
};

// ============================================================================
// EXAMPLE 8: User Roles/Permissions (Very Long Cache)
// ============================================================================

export const getUserRolesCached = async (userId) => {
  return await withCache(
    `user:roles:${userId}`,
    async () => {
      const result = await executeQuery(`
        SELECT r.* 
        FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = $1
      `, [userId]);
      return result.rows;
    },
    CacheTTL.ONE_HOUR // Roles rarely change
  );
};

// ============================================================================
// EXAMPLE 9: Batch Invalidation After Bulk Update
// ============================================================================

export const bulkUpdateMerchantsCached = async (merchantIds, data) => {
  // Perform bulk update
  const result = await executeQuery(
    'UPDATE merchants SET status = $1 WHERE id = ANY($2) RETURNING *',
    [data.status, merchantIds]
  );

  // Invalidate all related caches in one go
  await Promise.all([
    invalidateCache('merchants:list:*'),
    invalidateCache('merchants:paginated:*'),
    ...merchantIds.map(id => invalidateCache(`merchant:${id}`))
  ]);

  return result.rows;
};

// ============================================================================
// EXAMPLE 10: Conditional Caching (Cache only for specific conditions)
// ============================================================================

export const getTransactionsConditionalCache = async (filters) => {
  // Only cache if looking at historical data (older than 1 day)
  const isHistorical = new Date(filters.endDate) < new Date(Date.now() - 86400000);
  
  if (isHistorical) {
    return await withCache(
      `transactions:historical:${JSON.stringify(filters)}`,
      async () => {
        const result = await executeQuery('SELECT...', [...]);
        return result.rows;
      },
      CacheTTL.ONE_HOUR // Historical data can be cached longer
    );
  } else {
    // Real-time data - don't cache
    const result = await executeQuery('SELECT...', [...]);
    return result.rows;
  }
};

// ============================================================================
// QUICK REFERENCE: Cache TTL Recommendations
// ============================================================================

/**
 * ONE_MINUTE (60s):
 *   - Real-time dashboards
 *   - Live transaction feeds
 *   - Bank balances
 * 
 * FIVE_MINUTES (300s):
 *   - Merchant lists
 *   - Transaction history
 *   - Report data
 *   - Search results
 * 
 * TEN_MINUTES (600s):
 *   - User profiles
 *   - Bank account details
 *   - Vendor information
 * 
 * THIRTY_MINUTES (1800s):
 *   - Company settings
 *   - System configuration
 *   - Static dropdown data
 * 
 * ONE_HOUR (3600s):
 *   - User roles/permissions
 *   - Historical reports
 *   - Archive data
 * 
 * ONE_DAY (86400s):
 *   - Compliance documents
 *   - Audit logs (old)
 *   - Static reference data
 */
