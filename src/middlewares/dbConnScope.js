import { randomUUID } from 'crypto';
import { startDbConnScope, endDbConnScope, dbConnALS } from '../utils/dbConnectionTracker.js';

export default function dbConnScope(req, res, next) {
  const reqId = req.headers['x-request-id'] || randomUUID();

  // keep it accessible for logs if needed
  req.requestId = reqId;

  startDbConnScope(reqId);

  res.on('finish', () => {
    // ensure scope exists; end summary
    endDbConnScope();
  });

  // keep ALS store active across async chain
  dbConnALS.run(dbConnALS.getStore(), () => next());
}
