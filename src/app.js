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

const app = express();
export const usedTokens = new Set();

// Behind reverse proxy/load balancer, trust the first upstream proxy for accurate req.ip
app.set('trust proxy', 1);

app.use('/static', express.static('public'));
app.use(helmet());
// took Set here instead array as it will fast lookup 
const corsWhitelist = new Set([
  config.reactFrontOrigin,
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

app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  },
}));
app.use(express.urlencoded({
  limit: '50mb',
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
