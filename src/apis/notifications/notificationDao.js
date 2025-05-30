import { tableName } from '../../constants';
import { buildInsertQuery, executeQuery } from '../../utils/db';
import { logger } from '../../utils/logger';

export const getNotificationsDao = async (userId) => {
  try {
    const sql = `
          SELECT n.id, n.message, u.first_name + || ' '  || + u.last_name  as user, n.created_at, n.config
          FROM notifications n
          LEFT JOIN user u ON n.user_id = u.id
          WHERE u.user_id = $1
          ORDER BY n.created_at DESC;
        `;
    const values = [userId];
    const result = await executeQuery(sql, values);
    if (result.rows.length === 0) {
      return [];
    }
    return result.rows;
  } catch (error) {
    logger.error('Error in get Notifications Dao:', error);
    throw error;
  }
};

export const createNotificationsDao = async (payload) => {
    try {
        const [sql, params] = buildInsertQuery(tableName.NOTIFICATIONS, payload);
      const result = await executeQuery(sql, params);
      if (result.rows.length === 0) {
        return [];
      }
      logger.info('Notification created successfully:', result.rows[0]);
      return result.rows;
    } catch (error) {
      logger.error('Error in get Notifications Dao:', error);
      throw error;
    }
  };
