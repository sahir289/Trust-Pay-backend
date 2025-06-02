import { tableName } from '../../constants/index.js';
import { buildInsertQuery, executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

export const getNotificationsDao = async (user_id, company_id) => {
  try {
    const sql = `
       SELECT
            n.id,
            n.message,
            u."first_name" || ' ' || u."last_name" AS user,
            n.created_at,
            n.config
        FROM
            public."Notifications" n
        LEFT JOIN "User" u ON u."id" = n.user_id
        WHERE n.user_id = $1
        AND n.company_id = $2
        ORDER BY
            n.created_at DESC
        `;
    const values = [user_id, company_id];
    const result = await executeQuery(sql, values);
    if (result.rows.length === 0) {
      return [];
    }
    return result.rows;
  } catch (error) {
    logger.error('Error in get Notifications Dao:', error);
    throw new error.message;
  }
};

export const getNotificationByIdDao = async (id, user_id, company_id) => {
  try {
    const sql = `
        SELECT
            n.id,
            n.message,
            u."first_name" || ' ' || u."last_name" AS user,
            n.created_at,
            n.config
        FROM
            public."Notifications" n
        LEFT JOIN "User" u ON u."id" = n.user_id
        WHERE n.id = $1
        AND n.user_id = $2
        AND n.company_id = $3
        ORDER BY
            n.created_at DESC;
            `;
    const values = [id, user_id, company_id];
    const result = await executeQuery(sql, values);

    if (result.rows.length === 0) {
      return [];
    }
    return result.rows;
  } catch (error) {
    logger.error('Error in get Notification by Id Dao:', error);
    throw new error.message;
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
    throw new error.message;
  }
};
