import { pingDao } from './pingDao.js';
import { checkDatabaseHealth, getPoolStats } from '../../utils/db.js';

const pingService = async (req, res) => {
  return await pingDao(req, res);
};

// Memoize the DB probe so health pollers cost the DB at most one SELECT 1 per
// TTL per process, no matter how fast they poll. Single-flight so concurrent
// pollers on a cold/expired entry share one probe.
const HEALTH_DB_CHECK_TTL_MS = Number(
  process.env.HEALTH_DB_CHECK_TTL_MS || 5000,
);
let lastDbHealth = null;
let lastDbHealthAt = 0;
let inflightDbCheck = null;

const getDbHealthMemoized = async () => {
  if (lastDbHealth && Date.now() - lastDbHealthAt < HEALTH_DB_CHECK_TTL_MS) {
    return lastDbHealth;
  }

  if (!inflightDbCheck) {
    inflightDbCheck = checkDatabaseHealth({ pool: 'reader' })
      .then((health) => {
        lastDbHealth = health;
        lastDbHealthAt = Date.now();
        return health;
      })
      .finally(() => {
        inflightDbCheck = null;
      });
  }

  return inflightDbCheck;
};

const healthCheckService = async () => {
  const dbHealth = await getDbHealthMemoized();
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
