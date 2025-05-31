import { sendSuccess } from "../../utils/responseHandlers.js";
import { createNotificationsService, getNotificationsService } from "./notificationService.js";


export const getNotifications = async (req, res) => {
    const { userId, company_id } = req.user;
    const payload = req.body;
    console.log(payload, "payloadd");
    const notifications = getNotificationsService(userId, company_id);

    return sendSuccess(res, notifications, "Notifications fetched successfully");
}

export const createNotifications = async (req, res) => {
    const { userId, company_id } = req.user;
    const payload = req.body;
    console.log(payload, "payloadd");
    const notifications = createNotificationsService(userId, company_id);

    return sendSuccess(res, notifications, "Notifications Created successfully");
}

export const updateNotifications = async (req, res) => {
    const { userId, company_id } = req.user;
    const payload = req.body;
    console.log(payload, "payloadd");
    const notifications = createNotificationsService(userId, company_id);

    return sendSuccess(res, notifications, "Notifications Updated successfully");
}   

export const deleteNotifications = async (req, res) => {
    const { userId, company_id } = req.user;
    const payload = req.body;
    console.log(payload, "payloadd");
    const notifications = createNotificationsService(userId, company_id);

    return sendSuccess(res, notifications, "Notifications Deleted successfully");
}