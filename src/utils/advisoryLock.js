import { BadRequestError } from './appErrors.js';
import { logger } from './logger.js';


export async function checkLockEdit(conn, id) {
  try {
    // Convert UUID to integer for locking
    const lockKey = parseInt(id.replace(/-/g, ''), 16) % 1000000;

    // Attempt to acquire advisory lock
    const lockResult = await conn.query(
      'SELECT pg_try_advisory_xact_lock($1) AS acquired',
      [lockKey],
    );

    if (!lockResult.rows[0].acquired) {
      throw new BadRequestError(
        'This record is currently being updated by another user. Please try again later.',
      );
    }

    return { success: true, message: 'Record is available for editing.' };
  } catch (error) {
    logger.error('Error while attempting to check lock for ID', error);
    throw error
  }
}


