import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
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

app.use(cookieParser());
app.use(
  bodyParser.json({
    limit: '50mb',
    extended: true,
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 100000 }));
app.use(express.static('public'));
app.use(methodOverride());

// const corsWhitelist = process.env.CORS_WHITELIST
//   ? process.env.CORS_WHITELIST.split(',').map(url => url.trim())
//   : [
//       config.reactFrontOrigin,
//       config.reactPaymentOrigin,
//     ].filter(Boolean);

const corsWhitelist = [
  config.reactFrontOrigin,
  config.reactPaymentOrigin,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, postman)
      if (!origin) return callback(null, true);

      // In development, allow all
      if (config?.env !== 'production') return callback(null, true);

      // In production, check whitelist
      if (corsWhitelist.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS policy'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);
app.use(express.json());

// Request sanitization - MUST come early to sanitize all inputs
app.use(requestSanitizerMiddleware);

// Request timeout - configurable per route
app.use(requestTimeoutMiddleware);

app.use(addLogIdInRequest);
app.use(apis);
// Timeout: 10s for production, 30s for development (calculations can be slow)
app.use(timeout(config?.env === 'production' ? '20s' : '30s'));

app.use(errorHandler);
app.use(methodNotFound);

export default app;
