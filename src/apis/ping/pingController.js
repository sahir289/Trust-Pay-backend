import { sendSuccess } from '../../utils/responseHandlers.js';
import { pingService, healthCheckService } from './pingService.js';

const pingController = async (req, res) => {
  const data = await pingService(req, res);
  return sendSuccess(res, data);
};

const healthCheckController = async (req, res) => {
  const health = await healthCheckService();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  return sendSuccess(res, health, 'Health check completed', statusCode);
};

export { pingController, healthCheckController };
