import { getAllActiveSessionsDao, deleteUserSessionsDao } from './authDao.js';
import { forceLogoutUser } from '../../utils/sockets.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { logger } from '../../utils/logger.js';

/**
 * Get all active sessions for the current user
 */
const getUserSessionsController = async (req, res) => {
  try {
    const { user_id, company_id } = req.user;
    const currentSessionId = req.sessionId;
    
    const sessions = await getAllActiveSessionsDao(user_id, company_id);
    
    // Parse and format session data
    const formattedSessions = sessions.map(session => {
      const config = JSON.parse(session.config);
      const userInfo = config.user_info || {};
      
      return {
        session_id: session.session_id,
        created_at: session.created_at,
        is_current: session.session_id === currentSessionId,
        device_info: {
          ip: userInfo.user_ip || 'Unknown',
          hostname: userInfo.hostname || 'Unknown',
          platform: userInfo.os_platform || 'Unknown',
          login_time: config.login_time || session.created_at
        }
      };
    });
    
    return sendSuccess(res, {
      sessions: formattedSessions,
      total_sessions: sessions.length,
      current_session_id: currentSessionId
    }, 'Sessions retrieved successfully');
    
  } catch (error) {
    logger.error('Error getting user sessions:', error);
    throw new BadRequestError('Failed to retrieve sessions');
  }
};

/**
 * Terminate a specific session
 */
const terminateSessionController = async (req, res) => {
  try {
    const { session_id } = req.body;
    const { user_id, company_id } = req.user;
    const currentSessionId = req.sessionId;
    
    if (!session_id) {
      throw new BadRequestError('Session ID is required');
    }
    
    // Prevent terminating current session
    if (session_id === currentSessionId) {
      throw new BadRequestError('Cannot terminate current session. Use logout instead.');
    }
    
    // Verify the session belongs to the current user
    const sessions = await getAllActiveSessionsDao(user_id, company_id);
    const targetSession = sessions.find(s => s.session_id === session_id);
    
    if (!targetSession) {
      throw new BadRequestError('Session not found or already terminated');
    }
    
    // Force logout the session
    await forceLogoutUser(user_id, session_id);
    
    // Mark session as obsolete in database
    await deleteUserSessionsDao(user_id, company_id, session_id);
    
    logger.info(`Session ${session_id} terminated by user ${user_id}`);
    
    return sendSuccess(res, {
      terminated_session_id: session_id
    }, 'Session terminated successfully');
    
  } catch (error) {
    logger.error('Error terminating session:', error);
    throw new BadRequestError('Failed to terminate session');
  }
};

/**
 * Terminate all other sessions except current
 */
const terminateAllOtherSessionsController = async (req, res) => {
  try {
    const { user_id, company_id } = req.user;
    const currentSessionId = req.sessionId;
    
    const sessions = await getAllActiveSessionsDao(user_id, company_id);
    const otherSessions = sessions.filter(s => s.session_id !== currentSessionId);
    
    if (otherSessions.length === 0) {
      return sendSuccess(res, {
        terminated_sessions: 0
      }, 'No other sessions to terminate');
    }
    
    // Terminate all other sessions
    let terminatedCount = 0;
    for (const session of otherSessions) {
      try {
        await forceLogoutUser(user_id, session.session_id);
        await deleteUserSessionsDao(user_id, company_id, session.session_id);
        terminatedCount++;
        logger.info(`Terminated session ${session.session_id} for user ${user_id}`);
      } catch (error) {
        logger.error(`Failed to terminate session ${session.session_id}:`, error);
      }
    }
    
    return sendSuccess(res, {
      terminated_sessions: terminatedCount,
      total_other_sessions: otherSessions.length
    }, `${terminatedCount} sessions terminated successfully`);
    
  } catch (error) {
    logger.error('Error terminating all other sessions:', error);
    throw new BadRequestError('Failed to terminate sessions');
  }
};

/**
 * Check for concurrent sessions
 */
const checkConcurrentSessionsController = async (req, res) => {
  try {
    const { user_id, company_id } = req.user;
    const currentSessionId = req.sessionId;
    
    const sessions = await getAllActiveSessionsDao(user_id, company_id);
    const hasConcurrentSessions = sessions.length > 1;
    
    return sendSuccess(res, {
      has_concurrent_sessions: hasConcurrentSessions,
      total_sessions: sessions.length,
      current_session_id: currentSessionId,
      other_sessions: sessions
        .filter(s => s.session_id !== currentSessionId)
        .map(s => ({
          session_id: s.session_id,
          created_at: s.created_at
        }))
    }, 'Concurrent session check completed');
    
  } catch (error) {
    logger.error('Error checking concurrent sessions:', error);
    throw new BadRequestError('Failed to check concurrent sessions');
  }
};

export {
  getUserSessionsController,
  terminateSessionController,
  terminateAllOtherSessionsController,
  checkConcurrentSessionsController
};
