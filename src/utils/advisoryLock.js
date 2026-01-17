import { BadRequestError } from './appErrors.js';
import { logger } from './logger.js';
function stringToInt(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export async function checkLockEdit(conn, id, payin) {
  try {
    const lockKey = stringToInt(String(id));

    const lockResult = await conn.query(
      'SELECT pg_try_advisory_xact_lock($1) AS acquired',
      [lockKey],
    );
    if (!lockResult.rows[0]?.acquired) {
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
