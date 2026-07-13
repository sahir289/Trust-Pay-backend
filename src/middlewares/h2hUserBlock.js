import { sendError } from "../utils/responseHandlers.js";

export const checkh2hUserId = async (req, res, next) => {
    try {
      const merchantInfo = req.merchant;
      const userId = req.body?.userId;

      if (userId === undefined || userId === null || userId === '') {
        return sendError(res, 'UserId is required', 400);
      }
    
        if(!merchantInfo?.config?.is_h2h){
          return sendError(res, 'This User Not able to access api', 400);
        }

        if (merchantInfo?.config?.blocked_users) {
            const userIds = merchantInfo?.config.blocked_users[0].userId;
          if (userIds.length > 0 && userIds.includes(userId)) {
            return sendError(res, 'This user Blocked', 400);
          }
        }   
      next();
    } catch (error) {
      next(error);
    }
  };