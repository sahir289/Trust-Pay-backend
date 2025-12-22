import redisClient from './redisClient.js';
import { logger } from './logger.js';
import os from 'os';

// Unique identifier for this server instance
const SERVER_ID = `${os.hostname()}-${process.pid}-${Date.now()}`;
const CRON_LOCK_KEY = 'trustpay:cron:leader';
const LOCK_TTL = 60; // Lock expires after 60 seconds
const HEARTBEAT_INTERVAL = 30000; // Renew lock every 30 seconds

let heartbeatTimer = null;
let isLeader = false;

/**
 * Attempts to acquire the cron leader lock using Redis SET NX EX
 * Only one server instance can hold this lock at a time
 * @returns {Promise<boolean>} - True if this instance is the cron leader
 */
export async function acquireCronLock() {
  try {
    // Try to set the lock with NX (only if not exists) and EX (expiry)
    const result = await redisClient.set(CRON_LOCK_KEY, SERVER_ID, 'EX', LOCK_TTL, 'NX');
    
    if (result === 'OK') {
      isLeader = true;
      logger.info(`🔒 Cron leader lock acquired by server: ${SERVER_ID}`);
      startHeartbeat();
      return true;
    }
    
    // Check if we already hold the lock (in case of reconnection)
    const currentHolder = await redisClient.get(CRON_LOCK_KEY);
    if (currentHolder === SERVER_ID) {
      isLeader = true;
      logger.info(`🔒 Cron leader lock already held by this server: ${SERVER_ID}`);
      startHeartbeat();
      return true;
    }
    
    logger.info(`⏳ Cron leader lock held by another server: ${currentHolder}. This instance will not run cron jobs.`);
    return false;
  } catch (error) {
    logger.error('Error acquiring cron leader lock:', error);
    return false;
  }
}

/**
 * Renews the lock TTL to prevent expiration while this server is still running
 */
async function renewLock() {
  try {
    // Only renew if we still hold the lock
    const currentHolder = await redisClient.get(CRON_LOCK_KEY);
    
    if (currentHolder === SERVER_ID) {
      await redisClient.expire(CRON_LOCK_KEY, LOCK_TTL);
      logger.debug(`🔄 Cron leader lock renewed for server: ${SERVER_ID}`);
    } else {
      // We lost the lock somehow
      isLeader = false;
      stopHeartbeat();
      logger.warn(`⚠️ Cron leader lock lost! Current holder: ${currentHolder}`);
    }
  } catch (error) {
    logger.error('Error renewing cron leader lock:', error);
  }
}

/**
 * Starts the heartbeat timer to keep the lock alive
 */
function startHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  heartbeatTimer = setInterval(renewLock, HEARTBEAT_INTERVAL);
}

/**
 * Stops the heartbeat timer
 */
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Releases the cron leader lock
 */
export async function releaseCronLock() {
  try {
    stopHeartbeat();
    
    // Only delete if we hold the lock (using Lua script for atomicity)
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await redisClient.eval(luaScript, 1, CRON_LOCK_KEY, SERVER_ID);
    
    if (result === 1) {
      isLeader = false;
      logger.info(`🔓 Cron leader lock released by server: ${SERVER_ID}`);
    }
  } catch (error) {
    logger.error('Error releasing cron leader lock:', error);
  }
}

/**
 * Checks if this instance is the cron leader
 * @returns {boolean}
 */
export function isCronLeader() {
  return isLeader;
}

/**
 * Gets the current server ID
 * @returns {string}
 */
export function getServerId() {
  return SERVER_ID;
}

export default {
  acquireCronLock,
  releaseCronLock,
  isCronLeader,
  getServerId,
};
