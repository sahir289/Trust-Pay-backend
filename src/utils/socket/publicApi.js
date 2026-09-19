import chalk from 'chalk';
import { logger } from '../logger.js';
import { emitScopedOrBridgeSocketEvent } from './bridge.js';
import { getCompanyRoom, getUserRoom, getVendorRoom } from './roomUtils.js';
import { getSocketSessionId } from './socketMetadata.js';
import { safeFetchSessionSockets, safeFetchUserSockets } from './query.js';
import { socketRuntime } from './state.js';
import { terminateSocketSession } from './sessionUtils.js';

// Resolve the authorization room(s) a confidential payload belongs to.
// company_id is the tenant boundary; user_id scopes personal events (e.g. reports).
// Vendors are isolated to their own rooms (not the company room), so payouts and
// settlements are also delivered to the owning user's / vendor's room.
const resolveScopeRooms = (tableName, payload) => {
  const rooms = [];
  const companyId = payload?.company_id ?? payload?.companyId ?? null;
  const userId = payload?.userId ?? payload?.user_id ?? null;
  const table = String(tableName).toLowerCase();

  if (companyId) {
    rooms.push(getCompanyRoom(String(companyId)));
    if (userId && (table === 'payout' || table === 'settlement')) {
      rooms.push(getUserRoom(String(userId)));
    }
    if (table === 'payout' && payload?.vendor_code) {
      rooms.push(getVendorRoom(String(companyId), String(payload.vendor_code)));
    }
  } else if (userId) {
    rooms.push(getUserRoom(String(userId)));
  }

  return rooms;
};

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
  const rooms = resolveScopeRooms(null, payload);
  if (rooms.length === 0) {
    logger.error(`[SOCKET] Dropping ${eventName}: payload has no user/company scope`);
    return;
  }
  logger.log(
    chalk.bold.yellow(
      `[SOCKET] Emitting ${eventName} for vendor userId ${payload.userId} — ${bankCount} bank(s), level ${payload.notificationLevel}`,
    ),
  );
  await emitScopedOrBridgeSocketEvent(rooms, eventName, payload);
};

// Statement upload status cleared notification
const notifyStatementUploadCleared = async (payload) => {
  const eventName = 'statementUploadCleared';
  const rooms = resolveScopeRooms(null, payload);
  if (rooms.length === 0) {
    logger.error(`[SOCKET] Dropping ${eventName}: payload has no user/company scope`);
    return;
  }
  logger.log(
    chalk.bold.green(
      `[SOCKET] Emitting ${eventName} for bank ${payload.nickName}`,
    ),
  );
  await emitScopedOrBridgeSocketEvent(rooms, eventName, payload);
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

  const eventName = warningMode ? 'bankStatusWarning' : 'bankStatusUpdate';
  const payload = {
    message: warningMode
      ? `The Bank ${nickName} will be Deactivate soon as the Balance will soon reach the Daily Limit`
      : `The Bank ${nickName} is Deactivated`,
    bankId,
    nickname: nickName,
    userId,
    isEnabled: warningMode ? undefined : false,
  };

  const room = resolveScopeRooms(null, payload);
  if (room.length === 0) {
    logger.error(`[SOCKET] Dropping ${eventName}: payload has no user/company scope`);
    return;
  }

  emitScopedOrBridgeSocketEvent(room, eventName, payload).catch((error) => {
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

  const rooms = resolveScopeRooms(tableName, entryData);
  if (rooms.length === 0) {
    logger.error(`[SOCKET] Dropping ${eventName}: payload has no user/company scope`);
    return;
  }

  logger.info(
    chalk.bold.cyan(
      `Emitting ${eventName} for table ${tableName}, type ${entryType}`,
    ),
  );

  await emitScopedOrBridgeSocketEvent(rooms, eventName, payload);
};

const newTableEntry = async (tableName, data) => {
  const eventName = `newTableEntry${tableName}`;
  const rooms = resolveScopeRooms(tableName, data);
  if (rooms.length === 0) {
    logger.error(`[SOCKET] Dropping ${eventName}: payload has no company/user scope`);
    return;
  }
  logger.info(chalk.bold.cyan(`Emitting ${eventName} for table ${tableName}`));
  await emitScopedOrBridgeSocketEvent(rooms, eventName, data);
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

  await emitScopedOrBridgeSocketEvent(getUserRoom(userId), eventName, payload);
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
    await emitScopedOrBridgeSocketEvent(getUserRoom(userId), eventName, payload);
    await emitScopedOrBridgeSocketEvent(
      getUserRoom(userId),
      `${eventName}_personal`,
      payload,
    );
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
