import Logger from '../../utils/logger.js';
import { pingService } from './pingService.js';

const logger = new Logger();

const pingController = async (req, res) => {
  try {
    const data = pingService(req, res);
    logger.log('getting ping response', 'info', data);
    return res.status(200).json(data);
  } catch (error) {
    logger.log('error getting', 'error', error);
  }
};

export { pingController };
