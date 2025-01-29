import Logger from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { pingService } from './pingService.js';

const logger = new Logger();

const pingController = async (req, res) => {
  try {
    const data = pingService(req, res);
    logger.log('getting ping response', 'info', data);
    return sendSuccess(res, data, 'getting ping successfully');
  } catch (error) {
    logger.log('getting error while ping', 'error', error);
  }
};

export { pingController };
