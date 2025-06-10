import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createNotificationsService,
  getNotificationByIdService,
  getNotificationsService,
} from './notificationService.js';

export const getNotifications = async (req, res) => {
  const { user_id, company_id } = req.user;
  const notifications = await getNotificationsService(user_id, company_id);
  return sendSuccess(res, notifications, 'Notifications fetched successfully');
};

export const getNotificationsById = async (req, res) => {
  const { userId, company_id } = req.user;
  const { id } = req.params;

  const notifications = await getNotificationByIdService(
    id,
    userId,
    company_id,
  );
  return sendSuccess(res, notifications, 'Notifications fetched successfully');
};

export const createNotifications = async (req, res) => {
  const { user_id, company_id } = req.user;
  const payload = req.body;
  const notifications = await createNotificationsService(
    payload,
    user_id,
    company_id,
  );

  return sendSuccess(res, notifications, 'Notifications Created successfully');
};

export const deleteNotifications = async (req, res) => {
  const { userId, company_id } = req.user;
  const payload = req.body;
  console.log(payload, 'payload');
  const notifications = await createNotificationsService(userId, company_id);

  return sendSuccess(res, notifications, 'Notifications Deleted successfully');
};
