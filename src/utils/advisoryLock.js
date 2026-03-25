import { BadRequestError } from './appErrors.js';
import { executeQuery } from './db.js';
import { logger } from './logger.js';
function stringToInt(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export async function checkLockEdit(id, payin, conn = null) {
  try {
    const lockKey = stringToInt(id);
    const lockResult = await conn.query(
      'SELECT pg_try_advisory_xact_lock($1) AS acquired',
      [lockKey],
      // conn,
    );
    if (!lockResult?.rows[0]?.acquired) {
      throw new BadRequestError(
        'This record is currently being updated by another user. Please try again later.',
      );
    }
    if (!payin) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return true;
  } catch (error) {
    logger.error('Error while attempting to check lock for ID', {
      id,
      error,
    });
    throw error;
  }
}

/**
 * Acquires an advisory lock for a UTR to prevent concurrent duplicate processing
 * @param {string} utr - The UTR string to lock
 * @param {object} conn - Database connection (required for transaction-level lock)
 * @returns {Promise<boolean>} - True if lock acquired, false if already locked
 */
export async function acquireUTRLock(utr, conn) {
  try {
    if (!utr || typeof utr !== 'string') {
      logger.error('Invalid UTR provided for lock', { utr });
      return false;
    }

    if (!conn) {
      logger.error('Database connection required for UTR lock');
      return false;
    }

    // Generate deterministic lock key from UTR
    // Use hashCode algorithm for better distribution across UTR formats
    let hash = 0;
    for (let i = 0; i < utr.length; i++) {
      const char = utr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer ---  we can change it to 64 bit in future if needed ---
    }
    
    // Ensure positive integer within PostgreSQL advisory lock range
    const lockKey = Math.abs(hash) % 2147483647; // 32-bit signed integer max here

    const lockResult = await executeQuery(
      'SELECT pg_try_advisory_xact_lock($1) AS acquired',
      [lockKey],
      // conn,
    );

    const acquired = lockResult.rows[0]?.acquired || false;
    
    if (!acquired) {
      logger.warn(`Advisory lock not acquired for UTR: ${utr} (lockKey: ${lockKey})`);
    }

    return acquired;
  } catch (error) {
    logger.error('Error acquiring UTR advisory lock:', { utr, error: error.message });
    return false;
  }
}
