import { sendSuccess } from "../../utils/responseHandlers.js";
import { getNotificationsService } from "./notificationService.js";


export const getNotifications = async (req, res) => {
    const { userId, company_id } = req.user;
    const payload = req.body;
    console.log(payload, "payloadd");
    const notifications = getNotificationsService(userId, company_id);

    return sendSuccess(res, notifications, "Notifications fetched successfully");
}