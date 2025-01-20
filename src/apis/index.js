import express from 'express';
import ping from './ping/index.js';
import login from './auth/index.js';
import users from './users/index.js';

// Add your newly create component routes here with route prefix.
const router = express.Router();

router.use('/ping', ping);
router.use('/login', login);
router.use('/users', users);

/* Make sure while changing below parentrouter.
This is top level router created to enhance in future like versioning, route prefix etc. */
const parentRouter = express.Router();
parentRouter.use('/v1', router);

export default parentRouter;
