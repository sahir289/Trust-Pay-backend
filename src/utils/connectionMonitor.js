import { logger } from './logger.js';

/**
 * Connection Pool Monitor
 * Monitors PostgreSQL connection pool health and logs warnings
 */
export class ConnectionMonitor {
  constructor(writerPool, readerPool) {
    this.writerPool = writerPool;
    this.readerPool = readerPool;
    this.warningThreshold = 0.8; // Warn at 80% capacity
    this.monitorInterval = null;
  }

  getPoolStats(pool, poolName) {
    return {
      name: poolName,
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
      maxConnections: pool.options.max,
      utilizationPercent: ((pool.totalCount / pool.options.max) * 100).toFixed(2),
    };
  }

  checkPoolHealth() {
    const writerStats = this.getPoolStats(this.writerPool, 'Writer');
    const readerStats = this.getPoolStats(this.readerPool, 'Reader');

    // Log current status
    logger.info('DB Connection Pool Status', {
      writer: writerStats,
      reader: readerStats,
    });

    // Warning checks
    if (writerStats.utilizationPercent > this.warningThreshold * 100) {
      logger.warn(`⚠️ Writer pool high utilization: ${writerStats.utilizationPercent}%`, writerStats);
    }

    if (readerStats.utilizationPercent > this.warningThreshold * 100) {
      logger.warn(`⚠️ Reader pool high utilization: ${readerStats.utilizationPercent}%`, readerStats);
    }

    if (writerStats.waiting > 0) {
      logger.warn(`⚠️ Writer pool has ${writerStats.waiting} waiting clients`, writerStats);
    }

    if (readerStats.waiting > 0) {
      logger.warn(`⚠️ Reader pool has ${readerStats.waiting} waiting clients`, readerStats);
    }

    // Critical warnings
    if (writerStats.idle === 0 && writerStats.total === writerStats.maxConnections) {
      logger.error('🔴 Writer pool exhausted! All connections in use.', writerStats);
    }

    if (readerStats.idle === 0 && readerStats.total === readerStats.maxConnections) {
      logger.error('🔴 Reader pool exhausted! All connections in use.', readerStats);
    }

    return { writer: writerStats, reader: readerStats };
  }

  startMonitoring(intervalMs = 60000) {
    // Default: check every minute
    if (this.monitorInterval) {
      logger.warn('Connection monitor already running');
      return;
    }

    logger.info(`Starting connection pool monitor (interval: ${intervalMs}ms)`);
    this.monitorInterval = setInterval(() => {
      this.checkPoolHealth();
    }, intervalMs);
  }

  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      logger.info('Stopped connection pool monitor');
    }
  }

  // Immediate health check
  getHealth() {
    return this.checkPoolHealth();
  }
}
