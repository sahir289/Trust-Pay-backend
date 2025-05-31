import { logger } from "../../utils/logger.js";
import { createNotificationsDao, getNotificationsDao } from "./notificationDao.js";

export const getNotificationsService = async (payload) => {
    try {
        const { userId } = payload;
        const notifications = await getNotificationsDao(userId);
        return notifications;
    } catch (error) {
        logger.error("Error while getting Notifications", error);
        throw error;   
        
    }
}

export const createNotificationsService = async (payload) => {
    try {
        const { userId } = payload;
        console.log(userId, "userId in service");
        const notifications = await createNotificationsDao(payload);
        return notifications;
    } catch (error) {
        logger.error("Error while creating Notifications", error);
        throw error;   
        
    }
}
