import { getCompanyRoom, getSessionRoom, getUserRoom, getVendorRoom } from './roomUtils.js';
import { logger } from '../logger.js';
import {
  isCompanyStaff,
  isMerchantSideUser,
  isVendorSideUser,
  resolveVendorCodes,
} from './vendorScope.js';

const getSocketUserId = (socket) => {
  return socket?.data?.userId ?? socket?.userId ?? null;
};

const getSocketSessionId = (socket) => {
  return socket?.data?.sessionId ?? socket?.sessionId ?? null;
};

const getSocketLoginTime = (socket) => {
  return socket?.data?.loginTime ?? socket?.loginTime ?? 0;
};

const setSocketIdentity = async (
  socket,
  userId,
  sessionId,
  loginTime = Date.now(),
) => {
  const existingData = socket.data ?? undefined;

  socket.data = {
    ...existingData,
    userId,
    sessionId,
    loginTime,
  };

  socket.userId = userId;
  socket.sessionId = sessionId;
  socket.loginTime = loginTime;

  await socket.join(getUserRoom(userId));
  if (sessionId) {
    await socket.join(getSessionRoom(sessionId));
  }
};

const clearSocketIdentity = async (socket) => {
  const userId = getSocketUserId(socket);
  const sessionId = getSocketSessionId(socket);

  if (userId) {
    await socket.leave(getUserRoom(userId));
  }

  if (sessionId) {
    await socket.leave(getSessionRoom(sessionId));
  }

  if (socket.data) {
    delete socket.data.userId;
    delete socket.data.sessionId;
    delete socket.data.loginTime;
  }

  delete socket.userId;
  delete socket.sessionId;
  delete socket.loginTime;
};

// Join the rooms a socket is authorized for based on its authenticated JWT.
// Scope is derived from the server-verified token, never from client input, and
// the model is DEFAULT-DENY: only company staff join the company-wide room;
// vendors, merchants, and any unrecognized role are isolated so they can never
// receive another tenant's confidential events.
const joinAuthorizedRooms = async (socket) => {
  const authed = socket?.data?.authenticatedUser;
  if (!authed) {
    return;
  }

  const companyId = authed.company_id ? String(authed.company_id) : null;
  const userId = authed.user_id ? String(authed.user_id) : null;

  if (userId) {
    await socket.join(getUserRoom(userId));
  }

  if (!companyId) {
    return;
  }

  // Vendors: isolated to their own vendor-code rooms. Fail CLOSED — if codes
  // cannot be resolved, keep only the user room; never the company room.
  if (isVendorSideUser(authed)) {
    try {
      const vendorCodes = await resolveVendorCodes(authed);
      await Promise.all(
        vendorCodes.map((code) => socket.join(getVendorRoom(companyId, code))),
      );
    } catch (error) {
      logger.warn(
        `[SOCKET] Vendor code resolution failed for ${userId}; isolating to user room only: ${error.message}`,
      );
    }
    return;
  }

  // Merchants: isolated to their own user room (their settlements/reports are
  // routed there by resolveScopeRooms). Never the company room.
  if (isMerchantSideUser(authed)) {
    return;
  }

  // Only company staff receive the company-wide room.
  if (isCompanyStaff(authed)) {
    await socket.join(getCompanyRoom(companyId));
    return;
  }

  // Default deny: any unrecognized role stays isolated to its own user room.
  logger.warn(
    `[SOCKET] Unrecognized role for ${userId} (role=${authed.role}, designation=${authed.designation}); isolating to user room only`,
  );
};

export {
  clearSocketIdentity,
  getSocketLoginTime,
  getSocketSessionId,
  getSocketUserId,
  joinAuthorizedRooms,
  setSocketIdentity,
};
