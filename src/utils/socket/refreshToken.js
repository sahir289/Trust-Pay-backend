import cookie from 'cookie';
import { refreshAccessTokenFlow } from '../../services/refreshAccessToken.js';
import { BadRequestError } from '../appErrors.js';
import { logger } from '../logger.js';

const getRefreshTokenFromSocket = (socket) => {
  const cookieHeader =
    socket.request?.headers?.cookie ||
    socket.handshake?.headers?.cookie ||
    '';
  const cookies = cookie.parse(cookieHeader);

  if (cookies.refreshToken) {
    return cookies.refreshToken;
  }

  return null;
};

const registerRefreshTokenHandler = (socket) => {
  socket.on('refresh-token', async (payload = {}, ack) => {
    const respond = (data) => {
      if (typeof ack === 'function') {
        ack(data);
        return;
      }

      socket.emit('token-refreshed', data);
      socket.emit('refresh-token-response', data);
    };

    try {
      const refreshToken = getRefreshTokenFromSocket(socket);

      if (!refreshToken) {
        throw new BadRequestError('Refresh token cookie missing. Please login again.');
      }

      const result = await refreshAccessTokenFlow(refreshToken, {
        sessionId: payload.sessionId || null,
        expectedUserId: payload.userId || null,
      });

      respond({ success: true, accessToken: result.accessToken });
    } catch (error) {
      logger.error('[Socket] refresh-token error:', error);
      respond({
        success: false,
        message: error.message || 'Failed to refresh token',
      });
    }
  });
};

export { registerRefreshTokenHandler };
