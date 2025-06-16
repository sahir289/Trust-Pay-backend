import { InternalServerError, NotFoundError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import {
  createNotificationsDao,
  createNotificationsRecipientDao,
  getNotificationByIdDao,
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
      if (Array.isArray(recipient.config)) {
        return recipient.config.some(
          (cfg) => cfg.recipient_id === user_id && cfg.is_read === 'false',
        );
      }
      return false;
    });

    // Get notification IDs from filtered recipients
    const notificationIds = filteredRecipients.map(
      (recipient) => recipient.notification_id,
    );

    if (notificationIds.length === 0) {
      throw new NotFoundError('No notifications found for the user');
    }

    // Fetch notifications by IDs
    const notifications = await getNotificationByIdDao(
      notificationIds,
      user_id,
      company_id,
    );

    return notifications;
  } catch (error) {
    logger.error('Error while getting Notifications', error);
    throw new error();
  }
};

export const getNotificationByIdService = async (id, userId, company_id) => {
  try {
    // Get notification recipients for the given notification id(s) and company
    const notificationRecipients =
      await getNotificationRecipientByNotificationIdDao(id, company_id);

    // Filter recipients where config contains the userId
    const filteredRecipients = notificationRecipients.filter((recipient) => {
      if (Array.isArray(recipient.config)) {
        return recipient.config.some(
          (cfg) => cfg.recipient_id === userId && cfg.is_read === 'false',
        );
      }
      return false;
    });

    // Get notification IDs from filtered recipients
    const notificationIds = filteredRecipients.map(
      (recipient) => recipient.notification_id,
    );

    if (notificationIds.length === 0) {
      throw new NotFoundError('No notifications found for the user');
    }

    // Fetch notifications by IDs
    const notifications = await getNotificationByIdDao(
      notificationIds,
      userId,
      company_id,
    );

    return notifications;
  } catch (error) {
    logger.error('Error while getting Notifications', error);
    throw new error();
  }
};

export const createNotificationsService = async (
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

    await Promise.all(
      recipient_ids.map((recipient_id) => {
        const recipientPayload = {
          notification_id: notifications.id,
          company_id: company_id,
          config: {
            recipient_id,
            designation_id: payload.designation_id || null,
            is_read: 'false',
            read_at: null,
          },
        };
        return createNotificationsRecipientDao(recipientPayload);
      }),
    );
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
      throw new NotFoundError('Notification not found');
    }

    // Update only the recipient config for the current user_id, keeping other config data intact
    const updatedNotifications = await Promise.all(
      notificationRecipients.map(async (recipient) => {
        if (Array.isArray(recipient.config)) {
          // Find and update the config object for the current user_id
          const updatedConfig = recipient.config.map((cfg) =>
            cfg.recipient_id === user_id
              ? { ...cfg, is_read: 'true', read_at: new Date() }
              : cfg,
          );
          return updateNotificationsDao(recipient.id, {
            config: updatedConfig,
          });
        }
        // If config is not an array, just return the original recipient
        return recipient;
      }),
    );
    const notifications = updatedNotifications;

    return notifications;
  } catch (error) {
    logger.error('Error while updating Notifications', error);
    throw new error();
  }
};
