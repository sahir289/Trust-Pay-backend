import chalk from 'chalk';
import { logger } from '../logger.js';
import { getSocketSessionId } from './socketMetadata.js';
import { getMostRecentSessionId, groupSocketsBySessionId } from './sessionUtils.js';

const createSessionSnapshot = (sockets, currentSessionId = null) => {
  const sessionGroups = groupSocketsBySessionId(sockets);
  const activeSessionId = currentSessionId || getMostRecentSessionId(sessionGroups);
  const currentSessionSockets = activeSessionId
    ? sessionGroups.get(activeSessionId) || []
    : [];
  const sameBrowserSockets = sockets.filter(
    (socket) => getSocketSessionId(socket) === activeSessionId,
  );
  const differentDeviceSockets = sockets.filter(
    (socket) => getSocketSessionId(socket) !== activeSessionId,
  );

  return {
    activeSessionId,
    currentSessionSockets,
    differentDeviceSockets,
    sameBrowserSockets,
    sessionGroups,
    totalSessions: sessionGroups.size,
    totalSockets: sockets.length,
  };
};

const hasDifferentDeviceSessions = (snapshot) => {
  return snapshot.differentDeviceSockets.length > 0;
};

const logSessionBreakdown = ({
  userId,
  snapshot,
  headline,
  sameBrowserLabel = 'same browser tabs',
  differentDeviceLabel = 'different devices',
}) => {
  logger.info(
    chalk.bgYellow.white(
      `${headline} User ${userId}: ${snapshot.sameBrowserSockets.length} ${sameBrowserLabel}, ${snapshot.differentDeviceSockets.length} ${differentDeviceLabel}`,
    ),
  );
};

const logSameBrowserAllowed = ({ userId, count, message }) => {
  logger.info(
    chalk.bgGreen.white(message(userId, count)),
  );
};

const logDifferentDeviceTermination = ({ userId, count, message }) => {
  logger.info(
    chalk.bgRed.white(message(userId, count)),
  );
};

const createCleanupSnapshot = (userSockets, lastCleanupState, lastCleanupAction, userId) => {
  const snapshot = createSessionSnapshot(userSockets);
  const stateKey = `${userId}_${snapshot.totalSessions}_${snapshot.totalSockets}`;
  const lastState = lastCleanupState.get(userId);
  const lastAction = lastCleanupAction.get(userId);
  const now = Date.now();
  const hasMultipleDevices = snapshot.totalSessions > 1;
  const stateChanged = lastState?.stateKey !== stateKey;
  const longTimeSinceLog = !lastState || now - lastState.timestamp > 60000;
  const longTimeSinceAction = !lastAction || now - lastAction.timestamp > 300000;
  const shouldLog =
    hasMultipleDevices && (stateChanged || (longTimeSinceLog && longTimeSinceAction));

  return {
    ...snapshot,
    hasMultipleDevices,
    now,
    shouldLog,
    stateChanged,
    stateKey,
  };
};

export {
  createCleanupSnapshot,
  createSessionSnapshot,
  hasDifferentDeviceSessions,
  logDifferentDeviceTermination,
  logSameBrowserAllowed,
  logSessionBreakdown,
};
