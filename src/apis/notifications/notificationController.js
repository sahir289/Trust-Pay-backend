import { transactionWrapper } from '../../utils/db.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createNotificationsService,
  getNotificationByIdService,
  getNotificationsService,
  updateNotificationsService,
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
  const recipient_ids = payload.recipient_ids || [];
  delete payload.recipient_ids;
  const notifications = await transactionWrapper(createNotificationsService)(
    payload,
    user_id,
    company_id,
    recipient_ids
  );

  return sendSuccess(res, notifications, 'Notifications Created successfully');
};

export const updateNotifications = async (req, res) => {
  const { user_id, company_id } = req.user;
  const id = req.body;
  const notifications = await updateNotificationsService(
    id,
    user_id,
    company_id,
  );

  return sendSuccess(res, notifications, 'Notifications Created successfully');
};

export const deleteNotifications = async (req, res) => {
  const { userId, company_id } = req.user;
  const payload = req.params;
  console.log(payload, 'payload');
  const notifications = await createNotificationsService(userId, company_id);

  return sendSuccess(res, notifications, 'Notifications Deleted successfully');
};
