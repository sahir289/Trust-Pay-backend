const getUserRoom = (userId) => `user:${userId}`;
const getSessionRoom = (sessionId) => `session:${sessionId}`;

export { getSessionRoom, getUserRoom };
