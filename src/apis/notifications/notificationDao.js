import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { newTableEntry } from '../../utils/sockets.js';

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
        AND n.is_obsolete = false
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
    throw new error.message();
  }
};

export const getNotificationByIdDao = async (id, company_id) => {
  try {
    const ids = Array.isArray(id)
      ? id.map(x => (typeof x === 'string' ? x : x.id))
      : [typeof id === 'string' ? id : id.id];

    const isMultiple = ids.length > 1;
    const idPlaceholders = ids.map((_, idx) => `$${idx + 1}`).join(', ');

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
      WHERE n.id ${isMultiple ? `IN (${idPlaceholders})` : `= $1`}
        AND n.company_id = $${ids.length + 1}
        AND n.is_obsolete = false
      ORDER BY
        n.created_at DESC;
    `;
    const values = [...ids, company_id];
    const result = await executeQuery(sql, values);
    return result.rows || [];
  } catch (error) {
    logger.error('Error in getNotificationByIdDao:', error);
    throw error;
  }
};

export const getNotificationCountsByIdDao = async (id, company_id) => {
  try {
    const ids = Array.isArray(id)
      ? id.map(x => (typeof x === 'string' ? x : x.id))
      : [typeof id === 'string' ? id : id.id];

    const isMultiple = ids.length > 1;
    const idPlaceholders = ids.map((_, idx) => `$${idx + 1}`).join(', ');

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
      WHERE n.id ${isMultiple ? `IN (${idPlaceholders})` : `= $1`}
        AND n.company_id = $${ids.length + 1}
        AND n.is_obsolete = false;
    `;
    const values = [...ids, company_id];
    const result = await executeQuery(sql, values);
    return result.rows.length > 0 ? result.rows.length : 0;
  } catch (error) {
    logger.error('Error in getNotificationByIdDao:', error);
    throw error;
  }
};

export const getNotificationRecipientByNotificationDao = async (company_id) => {
  try {
    const sql = `
        SELECT
            nr.id,
            nr.notification_id,
            nr.created_at,
            nr.updated_at,
            nr.config
        FROM
            public."NotificationRecipients" nr
        WHERE nr.company_id = $1
        AND nr.is_obsolete = false
        ORDER BY
            nr.created_at DESC;
    `;
    const values = [company_id];
    const result = await executeQuery(sql, values);

    if (result.rows.length === 0) {
      return [];
    }
    return result.rows;
  } catch (error) {
    logger.error(
      'Error in get NotificationRecipient by Notifications Dao:',
      error,
    );
    throw new error.message();
  }
};

export const getNotificationRecipientByNotificationIdDao = async (
  id,
  company_id,
) => {
  try {
    // If id is an array, use IN clause; else, use equality
    const isArray = Array.isArray(id);
    const ids = isArray
      ? id.map((x) => (typeof x === 'string' ? x : x.id))
      : [typeof id === 'string' ? id : id.id];
    const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(', ');
    const sql = `
    SELECT
        nr.id,
        nr.notification_id,
        nr.created_at,
        nr.updated_at,
        nr.config
    FROM
        public."NotificationRecipients" nr
    WHERE nr.notification_id ${isArray ? `IN (${placeholders})` : `= $1`}
    AND nr.company_id = $${ids.length + 1}
    AND nr.is_obsolete = false
    ORDER BY
        nr.created_at DESC;
`;
    const values = [...ids, company_id];
    const result = await executeQuery(sql, values);

    if (result.rows.length === 0) {
      return [];
    }
    return result.rows;
  } catch (error) {
    logger.error(
      'Error in get NotificationRecipient by Notification Id Dao:',
      error,
    );
    throw new error.message();
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
    await newTableEntry(tableName.NOTIFICATIONS);
    return result.rows;
  } catch (error) {
    logger.error('Error in get Notifications Dao:', error);
    throw new error.message();
  }
};

export const createNotificationsRecipientDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(
      tableName.NOTIFICATION_RECIPIENTS,
      payload,
    );
    const result = await executeQuery(sql, params);

    if (result.rows.length === 0) {
      return [];
    }
    logger.info('Notification Recipient created successfully:', result.rows[0]);
    return result.rows;
  } catch (error) {
    logger.error('Error in get Notifications Recipient Dao:', error);
    throw new error.message();
  }
};

export const updateNotificationsDao = async (id, payload) => {
  try {
    const [sql, params] = buildUpdateQuery(
      tableName.NOTIFICATION_RECIPIENTS,
      payload,
      {
        id,
      },
    );
    const result = await executeQuery(sql, params);

    if (result.rows.length === 0) {
      return [];
    }
    await newTableEntry(tableName.NOTIFICATIONS);
    logger.info('Notification created successfully:', result.rows[0]);
    return result.rows;
  } catch (error) {
    logger.error('Error in get Notifications Dao:', error);
    throw new error.message();
  }
};
