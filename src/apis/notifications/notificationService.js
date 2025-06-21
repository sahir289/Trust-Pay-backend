import { tableName } from '../../constants/index.js';
import { InternalServerError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import { newTableEntry } from '../../utils/sockets.js';
import { getDesignationDao } from '../designation/designationDao.js';
import { getUserByIdDao } from '../users/userDao.js';
import {
  createNotificationsDao,
  createNotificationsRecipientDao,
  getNotificationByIdDao,
  getNotificationCountsByIdDao,
  getNotificationRecipientByNotificationDao,
  getNotificationRecipientByNotificationIdDao,
  updateNotificationsDao,
} from './notificationDao.js';

export const getNotificationsService = async (user_id, company_id) => {
  try {
    // Get all notification recipients for the company
    const notificationRecipients =
      await getNotificationRecipientByNotificationDao(company_id);

    // Filter recipients where config contains the user_id
    const filteredRecipients = notificationRecipients.filter((recipient) => {
      if (Array.isArray(recipient.config.recipients)) {
        return recipient.config.recipients.some(
          (cfg) => cfg.recipient_id === user_id,
        );
      }
      return false;
    });

    if (filteredRecipients.length === 0) {
      // throw new NotFoundError('No unread notifications found for the user');
      return [];
    }

    // Get notification IDs from filtered recipients
    // Separate unread and read notification IDs
    const unreadIds = [];
    const readIds = [];

    filteredRecipients.forEach((recipient) => {
      if (Array.isArray(recipient.config.recipients)) {
        const userCfg = recipient.config.recipients.find(
          (cfg) => cfg.recipient_id === user_id,
        );
        if (userCfg) {
          if (userCfg.is_read === 'false') {
            unreadIds.push(recipient.notification_id);
          } else {
            readIds.push(recipient.notification_id);
          }
        }
      }
    });

    // Combine unread first, then read
    const notificationIds = [...unreadIds, ...readIds];

    // Fetch notifications by IDs
    let notifications = await getNotificationByIdDao(
      notificationIds,
      company_id,
    );

    // Ensure notifications are returned in the same order as notificationIds
    notifications = notificationIds
      .map((id) => {
        const notification = notifications.find((n) => n.id === id);
        if (!notification) return null;
        // Find the recipient config for this user and notification
        const recipient = filteredRecipients.find(
          (r) => r.notification_id === id,
        );
        let is_read = null;
        if (recipient && Array.isArray(recipient.config.recipients)) {
          const userCfg = recipient.config.recipients.find(
            (cfg) => cfg.recipient_id === user_id,
          );
          if (userCfg) {
            is_read = userCfg.is_read;
          }
        }
        return { ...notification, is_read };
      })
      .filter(Boolean);

    return notifications;
  } catch (error) {
    logger.error('Error while getting Notifications', error);
    throw error;
  }
};

export const getNotificationCountsService = async (user_id, company_id) => {
  try {
    // Get all notification recipients for the company
    const notificationRecipients =
      await getNotificationRecipientByNotificationDao(company_id);

    // Filter recipients where config contains the user_id
    const filteredRecipients = notificationRecipients.filter((recipient) => {
      if (Array.isArray(recipient.config.recipients)) {
        return recipient.config.recipients.some(
          (cfg) => cfg.recipient_id === user_id && cfg.is_read === 'false',
        );
      }
      return false;
    });

    if (filteredRecipients.length === 0) {
      // throw new NotFoundError('No unread notifications found for the user');
      return []; // Return an empty array if no unread notifications found
    }

    // Get notification IDs from filtered recipients
    const notificationIds = filteredRecipients.map(
      (recipient) => recipient.notification_id,
    );

    // Fetch notifications by IDs
    const notifications = await getNotificationCountsByIdDao(
      notificationIds,
      company_id,
    );

    return notifications;
  } catch (error) {
    logger.error('Error while getting Notifications', error);
    throw error;
  }
};

export const getNotificationByIdService = async (id, userId, company_id) => {
  try {
    // Get notification recipients for the given notification id(s) and company
    const notificationRecipients =
      await getNotificationRecipientByNotificationIdDao(id, company_id);

    // Filter recipients where config contains the userId
    const filteredRecipients = notificationRecipients.filter((recipient) => {
      if (Array.isArray(recipient.config.recipients)) {
        return recipient.config.recipients.some(
          (cfg) => cfg.recipient_id === userId,
        );
      }
      return false;
    });

    if (filteredRecipients.length === 0) {
      // throw new NotFoundError('No unread notifications found for the user');
      return []; // Return an empty array if no unread notifications found
    }

    // Get notification IDs from filtered recipients
    const notificationIds = filteredRecipients.map(
      (recipient) => recipient.notification_id,
    );

    // Fetch notifications by IDs
    const notifications = await getNotificationByIdDao(
      notificationIds,
      userId,
      company_id,
    );

    return notifications;
  } catch (error) {
    logger.error('Error while getting Notifications', error);
    throw error;
  }
};

export const createNotificationsService = async (
  conn,
  payload,
  user_id,
  company_id,
  recipient_ids,
) => {
  try {
    const newPayload = {
      ...payload,
      user_id,
      company_id,
    };
    const notifications = await createNotificationsDao(newPayload);

    const users = await getUserByIdDao(conn, {
      user_id: recipient_ids,
      company_id,
    });

    const recipients = await Promise.all(
      recipient_ids.map(async (recipient_id) => {
        const user = users.find((u) => u.id === recipient_id);
        const designation = await getDesignationDao({
          designation: user?.designation,
        });
        return {
          recipient_id,
          designation_id: designation[0]?.id,
          is_read: 'false',
          read_at: null,
        };
      }),
    );

    const recipientPayload = {
      notification_id: notifications[0].id,
      company_id: company_id,
      config: { recipients },
    };
    await createNotificationsRecipientDao(recipientPayload);
    return notifications;
  } catch (error) {
    logger.error('Error while creating Notifications', error);
    throw new InternalServerError(error);
  }
};

export const updateNotificationsService = async (id, user_id, company_id) => {
  try {
    const ids = Array.isArray(id) ? id : [id];
    const notificationRecipients =
      await getNotificationRecipientByNotificationIdDao(ids, company_id);

    if (notificationRecipients.length === 0) {
      // throw new NotFoundError('Notification not found');
      return []; // Return an empty array if no notifications found
    }

    // Update only the recipient config for the current user_id, keeping other config data intact
    const updatedNotifications = await Promise.all(
      notificationRecipients.map(async (recipient) => {
        if (Array.isArray(recipient.config.recipients)) {
          // Find and update the config object for the current user_id
          const updatedRecipients = recipient.config.recipients.map((cfg) =>
            cfg.recipient_id === user_id
              ? { ...cfg, is_read: 'true', read_at: new Date() }
              : cfg,
          );
          return updateNotificationsDao(recipient.id, {
            config: { recipients: updatedRecipients },
          });
        }
        // If config is not an array, just return the original recipient
        return recipient;
      }),
    );
    // Only include the recipient config for the current user_id in the response
    const notifications = updatedNotifications[0].map((recipient) => {
      if (Array.isArray(recipient.config.recipients)) {
        return {
          ...recipient,
          config: {
            recipients: recipient.config.recipients.filter(
              (cfg) => cfg.recipient_id === user_id,
            ),
          },
        };
      }
      return recipient;
    });

    await newTableEntry(tableName.NOTIFICATIONS);

    return notifications;
  } catch (error) {
    logger.error('Error while updating Notifications', error);
    throw error;
  }
};
