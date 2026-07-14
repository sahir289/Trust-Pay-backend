import { V2_ERROR_CODES } from "../constants/index.js";
import logger from "../utils/logger.js";
import { sendError } from "../utils/responseHandlers.js";

export const checkh2hUserId = async (req, res, next) => {
    try {
      const merchantInfo = req.merchant;
      const userId = req.body?.userId;

      if (userId === undefined || userId === null || userId === '') {
        return sendError(res, 'UserId is required', 400);
      }
    
        if(!merchantInfo?.config?.is_h2h){
          logger.warn('this merchant is not h2h. Access denied.', { merchantId: merchantInfo?.id });
          return sendError(res, 'Access denied', 403, V2_ERROR_CODES.FORBIDDEN);
        }

        if (merchantInfo?.config?.blocked_users) {
            const userIds = merchantInfo?.config.blocked_users[0].userId;
          if (userIds.length > 0 && userIds.includes(userId)) {
            logger.warn('this user is blocked. Access denied.', { userId });  
            return sendError(res, 'Access denied', 403, V2_ERROR_CODES.FORBIDDEN);
          }
        }   
      next();
    } catch (error) {
      next(error);
    }
  };