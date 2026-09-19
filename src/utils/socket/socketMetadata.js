import { getCompanyRoom, getSessionRoom, getUserRoom, getVendorRoom } from './roomUtils.js';
import { logger } from '../logger.js';
import { isMerchantSideUser, isVendorSideUser, resolveVendorCodes } from './vendorScope.js';

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
// Scope is derived from the server-verified token, never from client input.
// Staff/merchants join the company room; vendors are isolated to their own
// vendor-code rooms so they never receive another vendor's confidential events.
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

  if (isVendorSideUser(authed)) {
    try {
      const vendorCodes = await resolveVendorCodes(authed);
      if (vendorCodes.length > 0) {
        await Promise.all(
          vendorCodes.map((code) => socket.join(getVendorRoom(companyId, code))),
        );
        return;
      }
    } catch (error) {
      logger.warn(
        `[SOCKET] Vendor code resolution failed for ${userId}; falling back to company room: ${error.message}`,
      );
    }
    // Fail-open: if codes can't be resolved, join the company room so the vendor
    // keeps receiving realtime updates (isolation degrades, availability preserved).
  }

  // Merchants are tenants too: isolate them to their own user room so they never
  // receive another merchant's company-wide events. Their own settlements/reports
  // are routed to their user room by resolveScopeRooms.
  if (isMerchantSideUser(authed)) {
    return;
  }

  await socket.join(getCompanyRoom(companyId));
};

export {
  clearSocketIdentity,
  getSocketLoginTime,
  getSocketSessionId,
  getSocketUserId,
  joinAuthorizedRooms,
  setSocketIdentity,
};
