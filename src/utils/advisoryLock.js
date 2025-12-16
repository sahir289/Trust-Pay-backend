import { BadRequestError } from './appErrors.js';
import { executeQuery } from './db.js';
import { logger } from './logger.js';

export async function checkLockEdit(id, payin, conn = null) {
  try {
    // Validate input
    if (!id || typeof id !== 'string') {
      throw new BadRequestError('Invalid lock ID: must be a non-empty string');
    }
    
    const lockKey = parseInt(id.replace(/-/g, ''), 16) % 1000000;
    
    // Check if lockKey is a valid number
    if (isNaN(lockKey)) {
      logger.error('Invalid lock key generated', { id, lockKey });
      throw new BadRequestError('Invalid lock ID: could not generate valid lock key');
    }
    
    const lockResult = await executeQuery(
      'SELECT pg_try_advisory_xact_lock($1) AS acquired',
      [lockKey],
      conn,
    );
    if (!lockResult.rows[0].acquired) {
      throw new BadRequestError(
        'This record is currently being updated by another user. Please try again later.',
      );
    }
    if (!payin) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return true;
  } catch (error) {
    logger.error('Error while attempting to check lock for ID', error);
    throw error;
  }
}
