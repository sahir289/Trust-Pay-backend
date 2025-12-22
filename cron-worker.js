import { logger } from './src/utils/logger.js';
import chalk from 'chalk';

logger.info(chalk.bold.green('Cron Worker Process Starting...'));

// Import all cron jobs - they will auto-start on import
import './src/cron/gatherAllData.js';
import './src/cron/notifyCron.js';
import './src/cron/calculationCron.js';
import './src/cron/pendingPayout.js';
import './src/cron/checkNetbalance.js';
import './src/cron/successRatioCron.js';

logger.info(chalk.bold.green('All cron jobs initialized successfully'));

// Graceful shutdown handler
let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  
  logger.info(chalk.bold.yellow(`Cron Worker received ${signal} - shutting down gracefully...`));
  
  try {
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
