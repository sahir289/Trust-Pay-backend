import Logger from '../../utils/logger.js';

const logger = new Logger();

const pingDao = async (req, res) => {
  try {
    const data = res.status(200).json({ message: 'pong' });
    logger.log('getting ping response', 'info', data);
    return res.status(200).json(data);
  } catch {
    logger.log('getting error', 'error');
  }
};

export { pingDao };
