import { AsyncLocalStorage } from 'node:async_hooks';
import { logger } from './logger.js';

export const dbConnALS = new AsyncLocalStorage();

/**
 * Start request scope (call from middleware). Stores counters + callsites.
 */
export function startDbConnScope(reqId) {
  dbConnALS.enterWith({
    reqId,
    count: 0,
    callsites: [],
  });
}

/**
 * Record a "getConnection()" callsite.
 */
export function trackDbConnection(callerInfo) {
  const store = dbConnALS.getStore();
  if (!store) return;

  store.count += 1;
  store.callsites.push(callerInfo);

  if (store.count > 1) {
    logger.warn('Multiple DB connections created in single request', {
      reqId: store.reqId,
      count: store.count,
      lastCaller: callerInfo,
    });
  }
}

/**
 * Dump summary at end (optional).
 */
export function endDbConnScope() {
  const store = dbConnALS.getStore();
  if (!store) return;

  if (store.count > 1) {
    logger.warn('DB connection usage summary', {
      reqId: store.reqId,
      count: store.count,
      callsites: store.callsites,
    });
  }
}
