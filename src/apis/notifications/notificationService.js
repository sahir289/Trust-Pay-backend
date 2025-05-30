import { logger } from "../../utils/logger";
import { getNotificationsDao } from "./notificationDao";

export const getNotificationsService = async (payload) => {
    try {
        const { userId } = payload;
        const notifications = await getNotificationsDao(userId);
        return notifications;
    } catch (error) {
        logger.error("Error in get Notifications Service:", error);
        throw error;   
        
    }
}
