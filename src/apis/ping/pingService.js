import { pingDao } from './pingDao.js';


const pingService = async (req, res) => {
  try {
    const data = pingDao(req, res);
    console.log('getting ping response', data);
    return data;
  } catch {
    console.error('not getting ping response');
  }
};

export { pingService };
