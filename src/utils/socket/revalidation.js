import { logger } from '../logger.js';
import { AuthenticationError } from '../appErrors.js';
import { validateSocketSession } from './authGuard.js';
import { getLocalSockets } from './query.js';
import { disconnectSocketSafely } from './sessionUtils.js';
import { socketRuntime } from './state.js';

const REVALIDATION_INTERVAL_MS = 60000;

// Returns 'session_revoked' only when the socket's session has definitively been
// invalidated (logout, admin disable, deleted/rotated session). A merely-expired
// access token is intentionally NOT disconnected: while the session stays valid
// the user is still authorized, and dropping idle tabs would only churn reconnects.
// Transient infra errors are ignored so a DB/Redis hiccup can't mass-logout users.
const getInvalidAuthReason = async (socket) => {
  const decoded = socket?.data?.authenticatedUser;
  if (!decoded) {
    return 'session_revoked';
  }

  try {
    await validateSocketSession(decoded);
    return null;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return 'session_revoked';
    }
    logger.warn(
      `[SOCKET] Skipping revalidation for ${socket.id} (transient error): ${error.message}`,
    );
    return null;
  }
};

const disconnectInvalidSocket = (socket, reason) => {
  try {
    socket.emit('session-terminated', {
      reason,
      message: 'Your session is no longer valid. Please login again.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn(
      `[SOCKET] Failed to notify ${socket.id} before revalidation disconnect: ${error.message}`,
    );
  }

  disconnectSocketSafely(socket, `auth revalidation (${reason})`);
};

// Disconnects local sockets whose session has been revoked, so a stale connection
// cannot keep receiving events from its rooms. Only local sockets are inspected,
// so each cluster node re-validates its own connections without adapter calls.
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
