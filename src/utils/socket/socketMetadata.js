import { getSessionRoom, getUserRoom } from './roomUtils.js';

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

export {
  clearSocketIdentity,
  getSocketLoginTime,
  getSocketSessionId,
  getSocketUserId,
  setSocketIdentity,
};
