import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import config from '../../config/config.js';
import { logger } from '../logger.js';
import { socketRuntime } from './state.js';

const SOCKET_BRIDGE_CHANNEL = 'trustpay:socket:event-bridge';

const getRedisUrl = () => config.redis?.url || 'redis://localhost:6379';

const logMissingSocketInstance = () => {
  if (socketRuntime.hasLoggedMissingSocketInstance) {
    return;
  }

  socketRuntime.hasLoggedMissingSocketInstance = true;
  logger.warn(
    '[SOCKET] Socket.IO not initialized in this process; switching to Redis socket bridge',
  );
};

const ensureSocketBridgePublisher = async () => {
  if (socketRuntime.socketBridgePub?.isOpen) {
    return socketRuntime.socketBridgePub;
  }

  const bridgePublisher = createClient({ url: getRedisUrl() });
  bridgePublisher.on('error', (error) =>
    logger.error('[SOCKET] Bridge pub client error:', error),
  );

  await bridgePublisher.connect();
  socketRuntime.socketBridgePub = bridgePublisher;
  logger.info('[SOCKET] Bridge pub client connected');
  return bridgePublisher;
};

const publishSocketBridgeEvent = async (eventName, payload) => {
  try {
    const publisher = await ensureSocketBridgePublisher();
    await publisher.publish(
      SOCKET_BRIDGE_CHANNEL,
      JSON.stringify({
        eventName,
        payload,
        pid: process.pid,
        ts: Date.now(),
      }),
    );
    return true;
  } catch (error) {
    logger.error('[SOCKET] Failed to publish bridge event:', {
      eventName,
      error: error.message,
    });
    return false;
  }
};

const emitOrBridgeSocketEvent = async (eventName, payload) => {
  if (socketRuntime.ioInstance) {
    socketRuntime.ioInstance.emit(eventName, payload);
    return true;
  }

  logMissingSocketInstance();
  return publishSocketBridgeEvent(eventName, payload);
};

const configureSocketInfrastructure = async () => {
  if (!socketRuntime.ioInstance) {
    return;
  }

  try {
    const redisUrl = getRedisUrl();
    const socketRedisPub = createClient({ url: redisUrl });
    const socketRedisSub = socketRedisPub.duplicate();

    socketRedisPub.on('error', (error) =>
      logger.error('[SOCKET] Redis pub client error:', error),
    );
    socketRedisSub.on('error', (error) =>
      logger.error('[SOCKET] Redis sub client error:', error),
    );

    await Promise.all([socketRedisPub.connect(), socketRedisSub.connect()]);

    socketRuntime.ioInstance.adapter(createAdapter(socketRedisPub, socketRedisSub));
    socketRuntime.socketRedisPub = socketRedisPub;
    socketRuntime.socketRedisSub = socketRedisSub;
    logger.info('[SOCKET] Redis adapter configured for PM2 cluster mode');

    const socketBridgeSub = createClient({ url: redisUrl });
    socketBridgeSub.on('error', (error) =>
      logger.error('[SOCKET] Bridge sub client error:', error),
    );

    await socketBridgeSub.connect();
    await socketBridgeSub.subscribe(SOCKET_BRIDGE_CHANNEL, (message) => {
      try {
        const parsed = JSON.parse(message);
        if (!parsed?.eventName || !socketRuntime.ioInstance) {
          return;
        }

        socketRuntime.ioInstance.emit(parsed.eventName, parsed.payload);
      } catch (error) {
        logger.error('[SOCKET] Failed to handle bridge message:', error);
      }
    });

    socketRuntime.socketBridgeSub = socketBridgeSub;
    logger.info('[SOCKET] Event bridge subscriber active');
  } catch (error) {
    logger.error('[SOCKET] Failed to setup Redis adapter:', error);
    logger.warn(
      '[SOCKET] Socket.IO running without Redis adapter - will NOT work in cluster mode!',
    );
  }
};

const closeSocketInfrastructure = async () => {
  try {
    if (socketRuntime.socketRedisPub?.isOpen) {
      await socketRuntime.socketRedisPub.quit();
      logger.info('[SOCKET] Redis pub client closed');
    }

    if (socketRuntime.socketRedisSub?.isOpen) {
      await socketRuntime.socketRedisSub.quit();
      logger.info('[SOCKET] Redis sub client closed');
    }

    if (socketRuntime.socketBridgePub?.isOpen) {
      await socketRuntime.socketBridgePub.quit();
      logger.info('[SOCKET] Bridge pub client closed');
    }

    if (socketRuntime.socketBridgeSub?.isOpen) {
      await socketRuntime.socketBridgeSub.quit();
      logger.info('[SOCKET] Bridge sub client closed');
    }
  } catch (error) {
    logger.error('[SOCKET] Error closing Redis clients:', error);
  } finally {
    socketRuntime.socketRedisPub = null;
    socketRuntime.socketRedisSub = null;
    socketRuntime.socketBridgePub = null;
    socketRuntime.socketBridgeSub = null;
  }
};

export {
  SOCKET_BRIDGE_CHANNEL,
  closeSocketInfrastructure,
  configureSocketInfrastructure,
  emitOrBridgeSocketEvent,
  logMissingSocketInstance,
};
