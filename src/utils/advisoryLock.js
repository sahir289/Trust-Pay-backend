import { BadRequestError } from './appErrors.js';
import { logger } from './logger.js';
import { beginTransaction, commit, rollback } from './db.js';

export async function checkLockEdit(conn, id) {
    try {
        await beginTransaction(conn);
        const lockKey = parseInt(id.replace(/-/g, ''), 16) % 1000000;
        const lockResult = await conn.query(
            'SELECT pg_try_advisory_xact_lock($1) AS acquired',
            [lockKey],
        );
        if (!lockResult.rows[0].acquired) {
            await rollback(conn);
            throw new BadRequestError(
                'This record is currently being updated by another user. Please try again later.',
            );
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await commit(conn);
        return true
    } catch (error) {
        await rollback(conn);
        logger.error('Error while attempting to check lock for ID', error);
        throw error;
    }
    finally {
        if (conn) {
          try {
            conn.release(); 
          } catch (releaseError) {
            logger.error(
              'Error while releasing the connection',
              'error',
              releaseError,
            );
          }
        }
    }
}
