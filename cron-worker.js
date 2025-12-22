import { logger } from './src/utils/logger.js';
import chalk from 'chalk';
import { acquireCronLock, releaseCronLock, isCronLeader, getServerId } from './src/utils/cronLock.js';

logger.info(chalk.bold.green('Cron Worker Process Starting...'));
logger.info(chalk.bold.blue(`Server ID: ${getServerId()}`));

// Try to acquire the distributed lock before starting cron jobs
const initializeCronJobs = async () => {
  const isLeader = await acquireCronLock();
  
  if (!isLeader) {
    logger.warn(chalk.bold.yellow('This instance is NOT the cron leader. Cron jobs will NOT run on this cluster.'));
    logger.info(chalk.bold.yellow('This instance will stay alive but idle. Another cluster is running the cron jobs.'));
    return;
  }
  
  logger.info(chalk.bold.green('This instance is the CRON LEADER. Initializing cron jobs...'));
  
  // Import all cron jobs - they will auto-start on import
  // Only imported if this instance is the leader
  await import('./src/cron/gatherAllData.js');
  await import('./src/cron/notifyCron.js');
  await import('./src/cron/calculationCron.js');
  await import('./src/cron/pendingPayout.js');
  await import('./src/cron/checkNetbalance.js');
  await import('./src/cron/successRatioCron.js');
  
  logger.info(chalk.bold.green('All cron jobs initialized successfully'));
};

// Initialize cron jobs with leader election
initializeCronJobs().catch((error) => {
  logger.error('Failed to initialize cron jobs:', error);
});

// Graceful shutdown handler
let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  
  logger.info(chalk.bold.yellow(`Cron Worker received ${signal} - shutting down gracefully...`));
  
  try {
    // Release the cron leader lock so another instance can take over
    if (isCronLeader()) {
      logger.info(chalk.bold.yellow('Releasing cron leader lock...'));
      await releaseCronLock();
    }
    
    // Flush logger
    await logger.close();
    
    logger.info(chalk.bold.green('Cron Worker shutdown complete'));
    process.exit(0);
  } catch (error) {
    logger.error('Error during cron worker shutdown:', error);
    process.exit(1);
  }
}

// Process event handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Just log errors without crashing - let individual crons handle their errors
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception in Cron Worker:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection in Cron Worker:', { reason, promise });
});
