import express from 'express';
import { writerPool, readerPool } from '../../utils/db.js';
import { ConnectionMonitor } from '../../utils/connectionMonitor.js';

const router = express.Router();

/**
 * @swagger
 * /health/db-pool:
 *   get:
 *     summary: Get database connection pool health status
 *     description: Returns detailed statistics about the PostgreSQL connection pools
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Connection pool health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 pools:
 *                   type: object
 *                   properties:
 *                     writer:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         total:
 *                           type: number
 *                         idle:
 *                           type: number
 *                         waiting:
 *                           type: number
 *                         maxConnections:
 *                           type: number
 *                         utilizationPercent:
 *                           type: string
 *                     reader:
 *                       type: object
 */
router.get('/db-pool', (req, res) => {
  try {
    const monitor = new ConnectionMonitor(writerPool, readerPool);
    const health = monitor.getHealth();
    
    // Determine overall health status
    const writerUtil = parseFloat(health.writer.utilizationPercent);
    const readerUtil = parseFloat(health.reader.utilizationPercent);
    const hasWaiting = health.writer.waiting > 0 || health.reader.waiting > 0;
    
    let status = 'healthy';
    if (writerUtil > 90 || readerUtil > 90 || hasWaiting) {
      status = 'critical';
    } else if (writerUtil > 80 || readerUtil > 80) {
      status = 'warning';
    }
    
    res.json({
      status,
      timestamp: new Date().toISOString(),
      pools: health,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
