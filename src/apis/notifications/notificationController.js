import { sendSuccess } from "../../utils/responseHandlers";
import { getNotificationsService } from "./notificationService";


export const getNotifications = async (req, res) => {
    const payload = req.body;
    const notifications = getNotificationsService(payload);

    return sendSuccess(res, notifications, "Notifications fetched successfully");
}