import { logger } from '../logger.js';
import { validateSocketSession } from './authGuard.js';
import { getLocalSockets } from './query.js';
import { disconnectSocketSafely } from './sessionUtils.js';
import { socketRuntime } from './state.js';

const REVALIDATION_INTERVAL_MS = 60000;

// Returns a reason string if the socket's authentication is no longer valid,
// otherwise null. Session revocation is checked first because it is the
// security-critical condition (logout, admin disable, deleted/rotated session);
// a merely-expired access token is a softer signal handled without a logout.
const getInvalidAuthReason = async (socket) => {
  const decoded = socket?.data?.authenticatedUser;
  if (!decoded) {
    return 'session_revoked';
  }

  try {
    await validateSocketSession(decoded);
  } catch {
    return 'session_revoked';
  }

  if (typeof decoded.exp === 'number' && decoded.exp * 1000 <= Date.now()) {
    return 'token_expired';
  }

  return null;
};

const disconnectInvalidSocket = (socket, reason) => {
  try {
    if (reason === 'token_expired') {
      // Soft signal: the client reconnects and re-authenticates with a refreshed
      // token; do not trigger an app logout for a mere access-token expiry.
      socket.emit('token_expired', { reason, timestamp: new Date().toISOString() });
    } else {
      socket.emit('session-terminated', {
        reason,
        message: 'Your session is no longer valid. Please login again.',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.warn(
      `[SOCKET] Failed to notify ${socket.id} before revalidation disconnect: ${error.message}`,
    );
  }

  disconnectSocketSafely(socket, `auth revalidation (${reason})`);
};

// Disconnects local sockets whose access token has expired or whose session has
// been revoked, so a stale connection cannot keep receiving events from its rooms.
const runRevalidationCycle = async () => {
  if (!socketRuntime.ioInstance) {
    return;
  }

  const sockets = getLocalSockets();
  for (const socket of sockets) {
    try {
      const reason = await getInvalidAuthReason(socket);
      if (reason) {
        logger.info(`[SOCKET] Revalidation disconnecting ${socket.id}: ${reason}`);
        disconnectInvalidSocket(socket, reason);
      }
    } catch (error) {
      logger.error(
        `[SOCKET] Error revalidating socket ${socket?.id}: ${error.message}`,
      );
    }
  }
};

const startAuthRevalidationMonitor = () => {
  socketRuntime.revalidationInterval = setInterval(async () => {
    try {
      await runRevalidationCycle();
    } catch (error) {
      logger.error(`[SOCKET] Error in auth revalidation cycle: ${error.message}`);
    }
  }, REVALIDATION_INTERVAL_MS);
};

export { getInvalidAuthReason, runRevalidationCycle, startAuthRevalidationMonitor };
