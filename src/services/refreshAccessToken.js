import { BadRequestError, AuthenticationError } from '../utils/appErrors.js';
import { verifyRefreshToken } from '../utils/auth.js';
import { refreshTokenService } from '../apis/auth/authService.js';
import { updateSessionDao } from '../apis/auth/authDao.js';
import { refreshAccessToken } from '../utils/auth.js';

/**
 * Full refresh flow — HTTP + Socket both call this.
 * @param {string} refreshToken  - from cookie
 * @param {{ sessionId?: string, expectedUserId?: string }} [options]
 * @returns {{ accessToken: string, userId: string, companyId: string, sessionId: string }}
 */
const refreshAccessTokenFlow = async (refreshToken, options = {}) => {
  const { sessionId = null, expectedUserId = null } = options;

  if (!refreshToken) {
    throw new BadRequestError('Unauthorized access, Try to login again');
  }

  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded || !decoded.user_id || !decoded.company_id) {
    throw new BadRequestError('Unauthorized access, Try to login again');
  }

  if (expectedUserId && String(expectedUserId) !== String(decoded.user_id)) {
    throw new AuthenticationError('User mismatch');
  }

  // Existing service: hash check against session
  const session = await refreshTokenService(
    decoded.user_id,
    decoded.company_id,
    refreshToken,
    sessionId,
  );

  if (
    sessionId &&
    session.session_id &&
    String(sessionId) !== String(session.session_id)
  ) {
    throw new AuthenticationError('Session mismatch');
  }

  // auth.js — access token only
  const { accessToken } = refreshAccessToken(decoded);

  const config = session.parsedConfig
    ? { ...session.parsedConfig }
    : (typeof session.config === 'object' && session.config !== null
      ? { ...session.config }
      : {});

  if (!config.token) config.token = {};
  config.token.access_token = accessToken;

  await updateSessionDao(
    decoded.user_id,
    decoded.company_id,
    session.session_id,
    config,
  );

  return {
    accessToken,
    userId: decoded.user_id,
    companyId: decoded.company_id,
    sessionId: session.session_id,
  };
};

export { refreshAccessTokenFlow };