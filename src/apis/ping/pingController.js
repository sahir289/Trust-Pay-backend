import { sendSuccess } from '../../utils/responseHandlers.js';
import { pingService } from './pingService.js';


const pingController = async (req, res) => {
  try {
    const data = pingService(req, res);
    console.log('getting ping response', data);
    return sendSuccess(res, data, 'getting ping successfully');
  } catch (error) {
    console.error('getting error while ping',  error);
  }
};

export { pingController };
