import { InternalServerError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import {
  createNotificationsDao,
  getNotificationByIdDao,
  getNotificationsDao,
} from './notificationDao.js';

export const getNotificationsService = async (user_id, company_id) => {
  try {
    const notifications = await getNotificationsDao(user_id, company_id);
    return notifications;
  } catch (error) {
    logger.error('Error while getting Notifications', error);
    throw new InternalServerError(error);
  }
};

export const getNotificationByIdService = async (id, userId, company_id) => {
  try {
    const notifications = await getNotificationByIdDao(id, userId, company_id);
    return notifications;
  } catch (error) {
    logger.error('Error while getting Notifications', error);
    throw new InternalServerError(error);
  }
};

export const createNotificationsService = async (payload, user_id, company_id) => {
  try {
    const newPayload = {
        ...payload,
        user_id,
        company_id,
    }
    const notifications = await createNotificationsDao(newPayload);
    return notifications;
  } catch (error) {
    logger.error('Error while creating Notifications', error);
    throw new InternalServerError(error);
  }
};
