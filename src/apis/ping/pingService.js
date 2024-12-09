import Logger from '../../utils/logger.js';
import { pingDao } from './pingDao.js';

const logger = new Logger();

const pingService = async (req, res) => {
  try {
    const data = pingDao(req, res);
    logger.log('getting ping response', 'info', data);
    return res.status(200).json(data);
  } catch {
    logger.log('not getting ping response', 'error');
  }
};

export { pingService };
