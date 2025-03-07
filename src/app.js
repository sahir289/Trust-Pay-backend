import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import {
  methodNotFound,
  addLogIdInRequest,
} from './middlewares/requestExtension.js';
import apis from './apis/index.js';
import errorHandler from './middlewares/errorHandler.js';
import config from './config/config.js';
import swaggerUi from 'swagger-ui-express';
import '../src/cron/gatherAllData.js';
import { swaggerSpecs } from '../swaggerConfig.js';
const app = express();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb', extended: true }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));
app.use(methodOverride());
app.use(
  cors({
    origin: [`${config?.reactFrontOrigin}`, `${config?.reactPaymentOrigin}`], // List all frontend URLs
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed methods
    credentials: true,
  }),
);
app.use(express.json());

app.use(addLogIdInRequest);
app.use(apis);

app.use(errorHandler);
app.use(methodNotFound);

export default app;
