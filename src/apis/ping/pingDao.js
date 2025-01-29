import Logger from '../../utils/logger.js';

const logger = new Logger();

const pingDao = async (req, res) => {
  try {
    const data = res.status(200).json({ message: 'pong' });
    console.log(data.message, "data0000")
    logger.log('getting ping response', 'info', data);
    return data;
  } catch {
    logger.log('getting error', 'error');
  }
};

export { pingDao };
