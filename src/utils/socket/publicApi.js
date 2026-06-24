import chalk from 'chalk';
import { logger } from '../logger.js';
import { emitOrBridgeSocketEvent } from './bridge.js';
import { getUserRoom } from './roomUtils.js';
import { getSocketSessionId } from './socketMetadata.js';
import { safeFetchSessionSockets, safeFetchUserSockets } from './query.js';
import { socketRuntime } from './state.js';
import { terminateSocketSession } from './sessionUtils.js';

const forceLogoutUser = async (
  userId,
  targetSessionId = null,
  excludeSessionId = null,
) => {
  if (!socketRuntime.ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }

  try {
    logger.info(
      chalk.bgRed.white(
        `[SOCKET] forceLogoutUser - userId: ${userId}, target: ${targetSessionId}, exclude: ${excludeSessionId}`,
      ),
    );

    const userActiveSockets = targetSessionId
      ? await safeFetchSessionSockets(targetSessionId, 'force logout target session')
      : await safeFetchUserSockets(userId, 'force logout user room');

    logger.info(
      chalk.bgRed.white(
        `[SOCKET] Found ${userActiveSockets.length} active sockets for user ${userId}`,
      ),
    );

    const disconnectionTasks = userActiveSockets
      .filter((socket) => {
        if (excludeSessionId && getSocketSessionId(socket) === excludeSessionId) {
          logger.info(
            chalk.green(
              `[SOCKET] Preserving session ${socket.id} with sessionId ${excludeSessionId}`,
            ),
          );
          return false;
        }

        if (targetSessionId && getSocketSessionId(socket) !== targetSessionId) {
          logger.info(
            chalk.green(`[SOCKET] Skipping non-target session ${socket.id}`),
          );
          return false;
        }

        return true;
      })
      .map(async (socket) => {
        logger.info(
          chalk.red(`[SOCKET] Force disconnecting socket ${socket.id}`),
        );

        terminateSocketSession(
          socket,
          {
            reason: 'force_logout',
            userId,
            sessionId: getSocketSessionId(socket) || 'unknown',
            message: 'Session terminated by server.',
            sessionTerminatedMessage: 'Please login again',
            timestamp: new Date().toISOString(),
            immediate: true,
            priority: 'CRITICAL',
          },
          'force logout',
          {
            emitSessionTerminated: true,
            emitLegacyEvents: true,
          },
        );
      });

    await Promise.allSettled(disconnectionTasks);

    if (excludeSessionId) {
      const preservedSockets = userActiveSockets.filter(
        (socket) => getSocketSessionId(socket) === excludeSessionId,
      );

      if (preservedSockets.length > 0) {
        socketRuntime.userSockets.set(
          userId,
          preservedSockets.map((socket) => socket.id),
        );
      } else {
        socketRuntime.userSockets.delete(userId);
      }
    } else {
      socketRuntime.userSockets.delete(userId);
    }

    logger.info(
      chalk.green(`[SOCKET] Completed force logout for user ${userId}`),
    );
  } catch (error) {
    logger.error(`[SOCKET] Error in forceLogoutUser: ${error.message}`);
    logger.error(error.stack);
  }

  if (!excludeSessionId && socketRuntime.ioInstance) {
    socketRuntime.ioInstance.to(getUserRoom(userId)).emit('userLoggedOut', {
      userId,
      sessionId: targetSessionId,
      reason: 'forced_logout',
    });
  }
};

// Statement upload reminder notification (targeted to specific vendor by userId)
const notifyStatementUpload = async (payload) => {
  const eventName = 'statementUploadReminder';
  const bankCount = payload.banks?.length || 0;
  logger.log(
    chalk.bold.yellow(
      `[SOCKET] Emitting ${eventName} for vendor userId ${payload.userId} — ${bankCount} bank(s), level ${payload.notificationLevel}`,
    ),
  );
  await emitOrBridgeSocketEvent(eventName, payload);
};

// Statement upload status cleared notification
const notifyStatementUploadCleared = async (payload) => {
  const eventName = 'statementUploadCleared';
  logger.log(
    chalk.bold.green(
      `[SOCKET] Emitting ${eventName} for bank ${payload.nickName}`,
    ),
  );
  await emitOrBridgeSocketEvent(eventName, payload);
};

const deactivateBank = (
  nickName,
  bankId,
  userIdOrWarning = null,
  isWarning = false,
) => {
  const warningMode =
    typeof userIdOrWarning === 'boolean' ? userIdOrWarning : isWarning;
  const userId = typeof userIdOrWarning === 'boolean' ? undefined : userIdOrWarning;

  emitOrBridgeSocketEvent(
    warningMode ? 'bankStatusWarning' : 'bankStatusUpdate',
    {
      message: warningMode
        ? `The Bank ${nickName} will be Deactivate soon as the Balance will soon reach the Daily Limit`
        : `The Bank ${nickName} is Deactivated`,
      bankId,
      nickname: nickName,
      userId,
      isEnabled: warningMode ? undefined : false,
    },
  ).catch((error) => {
    logger.error('[SOCKET] Failed to emit bank status update:', error);
  });
};

const notifyNewTableEntry = async (tableName, entryType, entryData) => {
  const eventName = `newTableEntry${tableName}`;
  const payload = {
    tableName,
    entryType,
    entryData,
    timestamp: new Date().toISOString(),
  };

  logger.info(
    chalk.bold.cyan(
      `Emitting ${eventName} for table ${tableName}, type ${entryType}`,
    ),
  );

  await emitOrBridgeSocketEvent(eventName, payload);
};

const newTableEntry = async (tableName, data) => {
  const eventName = `newTableEntry${tableName}`;
  logger.info(chalk.bold.cyan(`Emitting ${eventName} for table ${tableName}`));
  await emitOrBridgeSocketEvent(eventName, data);
};

const logOutUser = async (userId, sessionId = null) => {
  const eventName = 'newlogout';
  const sessionLabel = sessionId ? ` (session ${sessionId})` : '';
  logger.info(
    chalk.bold.cyan(`Emitting ${eventName} for ${userId}${sessionLabel}`),
  );

  const payload = {
    userId,
    sessionId,
  };

  if (socketRuntime.ioInstance) {
    socketRuntime.ioInstance.to(getUserRoom(userId)).emit(eventName, payload);
    return;
  }

  await emitOrBridgeSocketEvent(eventName, payload);
};

const notifyBankResponseAccessUpdate = async (
  userId,
  bankResponseAccess,
  vendorCode,
) => {
  const eventName = 'bankResponseAccessUpdate';
  const payload = {
    user_id: userId,
    bank_response_access: bankResponseAccess,
    vendor_code: vendorCode,
    message: `Bank response access updated for vendor ${vendorCode}`,
    timestamp: new Date().toISOString(),
  };

  logger.info(
    chalk.bold.magenta(
      `[SOCKET] Emitting ${eventName} for user ${userId}, vendor ${vendorCode}, access: ${bankResponseAccess}`,
    ),
  );

  if (!socketRuntime.ioInstance) {
    await emitOrBridgeSocketEvent(eventName, payload);
    return;
  }

  socketRuntime.ioInstance.to(getUserRoom(userId)).emit(eventName, payload);
  socketRuntime.ioInstance
    .to(getUserRoom(userId))
    .emit(`${eventName}_personal`, payload);

  logger.info(
    chalk.bold.cyan(
      `[SOCKET] Sent room-based bank response access update to user ${userId}`,
    ),
  );
};

export {
  deactivateBank,
  forceLogoutUser,
  logOutUser,
  newTableEntry,
  notifyBankResponseAccessUpdate,
  notifyNewTableEntry,
  notifyStatementUpload,
  notifyStatementUploadCleared,
};
