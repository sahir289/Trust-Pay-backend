import { pingDao } from './pingDao.js';
import { checkDatabaseHealth, getPoolStats } from '../../utils/db.js';

const pingService = async (req, res) => {
  return await pingDao(req, res);
};

const healthCheckService = async () => {
  const dbHealth = await checkDatabaseHealth();
  const poolStats = getPoolStats();
  
  return {
    status: dbHealth.status,
    timestamp: new Date().toISOString(),
    database: dbHealth,
    pools: poolStats,
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  };
};

export { pingService, healthCheckService };
