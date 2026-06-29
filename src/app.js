import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import timeout from 'connect-timeout';
import {
  methodNotFound,
  addLogIdInRequest,
} from './middlewares/requestExtension.js';
import { requestTimeoutMiddleware } from './middlewares/requestTimeout.js';
import { requestSanitizerMiddleware } from './middlewares/requestSanitizer.js';
import apis from './apis/index.js';
import errorHandler from './middlewares/errorHandler.js';
import config from './config/config.js';
import { BoundedSet } from './utils/boundedSet.js';

const app = express();
// Bounded idempotency cache for processed merchant order ids. The DB column
// `one_time_used` remains the authoritative guard; this only avoids redundant
// work and must stay memory-bounded under sustained traffic.
export const usedTokens = new BoundedSet(
  Number.parseInt(process.env.USED_TOKENS_MAX || '100000', 10),
);

// Behind reverse proxy/load balancer, trust the first upstream proxy for accurate req.ip
app.set('trust proxy', 1);

app.use('/static', express.static('public'));
app.use(helmet());
// took Set here instead array as it will fast lookup 
const corsWhitelist = new Set([
  config.reactFrontOrigin1,
  config.reactFrontOrigin2,
  config.reactPaymentOrigin,
].filter(Boolean));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (config?.env !== 'production') return callback(null, true);

    if (corsWhitelist.has(origin)) {
      return callback(null, true);
    }
    console.warn('Blocked by CORS:', origin);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'x-api-key'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // it will handle preflight

// Cap request body size to limit memory-amplification DoS. Configurable via
// JSON_BODY_LIMIT for the rare bulk endpoint that needs more.
const BODY_LIMIT = config?.bodyLimit || process.env.JSON_BODY_LIMIT || '5mb';

app.use(express.json({
  limit: BODY_LIMIT,
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  },
}));
app.use(express.urlencoded({
  limit: BODY_LIMIT,
  extended: true,
  parameterLimit: 100000,
}));

app.use(cookieParser());
app.use(methodOverride());

// Request sanitization - MUST come early to sanitize all inputs
app.use(requestSanitizerMiddleware);

// Request timeout - configurable per route
app.use(requestTimeoutMiddleware);

app.use(addLogIdInRequest);
app.use(apis);
// Timeout: 10s for production, 30s for development (calculations can be slow)
app.use(timeout(config?.env === 'production' ? '20s' : '30s'));

app.use(methodNotFound);
app.use(errorHandler);

export default app;
