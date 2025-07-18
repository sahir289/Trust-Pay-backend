import { logger } from '../utils/logger.js';
import { getAllActiveSessionsDao, deleteUserSessionsDao } from '../apis/auth/authDao.js';
import { forceLogoutUser } from '../utils/sockets.js';
import chalk from 'chalk';

/**
 * Middleware to enforce single session per user
 * This prevents concurrent login sessions from the same user across different devices/browsers
 */
const enforceSingleSession = async (userId, companyId, currentSessionId, conn = null) => {
  try {
    logger.info(chalk.yellow(`[SESSION] Checking for concurrent sessions for user: ${userId}`));
    
    // Get all active sessions for this user
    const activeSessions = await getAllActiveSessionsDao(userId, companyId);
    
    if (activeSessions.length === 0) {
      logger.info(chalk.green(`[SESSION] No existing sessions found for user: ${userId}`));
      return;
    }
    
    logger.info(chalk.yellow(`[SESSION] Found ${activeSessions.length} active session(s) for user: ${userId}`));
    
    // Force logout all existing sessions except the current one (if provided)
    for (const session of activeSessions) {
      if (session.session_id === currentSessionId) {
        logger.info(chalk.blue(`[SESSION] Keeping current session: ${session.session_id}`));
        continue;
      }
      
      logger.info(chalk.red(`[SESSION] Terminating concurrent session: ${session.session_id}`));
      
      try {
        // Force logout via WebSocket
        await forceLogoutUser(userId, session.session_id);
        
        // Mark session as obsolete in database
        await deleteUserSessionsDao(userId, companyId, session.session_id, conn);
        
        logger.info(chalk.green(`[SESSION] Successfully terminated session: ${session.session_id}`));
      } catch (error) {
        logger.error(chalk.red(`[SESSION] Error terminating session ${session.session_id}: ${error.message}`));
      }
    }
    
    // Verify cleanup was successful
    const remainingSessions = await getAllActiveSessionsDao(userId, companyId);
    const validRemainingSessions = remainingSessions.filter(s => 
      currentSessionId ? s.session_id === currentSessionId : false
    );
    
    if (remainingSessions.length > validRemainingSessions.length) {
      logger.warn(chalk.red(`[SESSION] Warning: ${remainingSessions.length - validRemainingSessions.length} unexpected sessions still active for user: ${userId}`));
    } else {
      logger.info(chalk.green(`[SESSION] Session cleanup completed successfully for user: ${userId}`));
    }
    
  } catch (error) {
    logger.error(chalk.red(`[SESSION] Error in concurrent session enforcement: ${error.message}`));
    throw error;
  }
};

/**
 * Express middleware to check for concurrent sessions on each authenticated request
 */
const checkConcurrentSessions = async (req, res, next) => {
  try {
    const { user_id, company_id } = req.user;
    const currentSessionId = req.sessionId;
    
    // Skip session check for certain endpoints to avoid infinite loops
    const skipPaths = ['/auth/logout', '/auth/refresh-token'];
    if (skipPaths.some(path => req.path.includes(path))) {
      return next();
    }
    
    // Get all active sessions for this user
    const activeSessions = await getAllActiveSessionsDao(user_id, company_id);
    
    // If multiple sessions exist, enforce single session
    if (activeSessions.length > 1) {
      logger.warn(chalk.yellow(`[SESSION] Multiple concurrent sessions detected for user: ${user_id}`));
      
      // Check if current session is still valid
      const currentSessionExists = activeSessions.some(s => s.session_id === currentSessionId);
      
      if (!currentSessionExists) {
        logger.warn(chalk.red(`[SESSION] Current session ${currentSessionId} not found in active sessions for user: ${user_id}`));
        return res.status(401).json({
          error: 'Session terminated due to concurrent login',
          code: 'CONCURRENT_SESSION_DETECTED'
        });
      }
      
      // Terminate other sessions
      await enforceSingleSession(user_id, company_id, currentSessionId);
    }
    
    next();
  } catch (error) {
    logger.error(`[SESSION] Error in concurrent session check: ${error.message}`);
    next(); // Continue on error to avoid breaking the application
  }
};

/**
 * Check if a user has multiple active sessions
 */
const hasMultipleSessions = async (userId, companyId) => {
  try {
    const activeSessions = await getAllActiveSessionsDao(userId, companyId);
    return activeSessions.length > 1;
  } catch (error) {
    logger.error(`[SESSION] Error checking multiple sessions: ${error.message}`);
    return false;
  }
};

export {
  enforceSingleSession,
  checkConcurrentSessions,
  hasMultipleSessions
};
