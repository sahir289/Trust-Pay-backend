import express from 'express';
import ping from './ping/index.js';
import auth from './auth/index.js';
import login from './auth/index.js';
import users from './users/index.js';
import merchants from './merchants/index.js';
import vendors from './vendors/index.js';
import chargeBacks from './chargeBacks/index.js';
import bankAccounts from "./bankAccounts/index.js";
import reports from "./reports/index.js";
import roles from './roles/index.js';
// Add your newly create component routes here with route prefix.
const router = express.Router();

router.use('/ping', ping);
router.use('/auth', auth);
router.use('/login', login);
router.use('/users', users);
router.use('/merchant', merchants);
router.use('/vendor', vendors);
router.use('/chargeBack', chargeBacks);
router.use("/bankaccounts",bankAccounts)
router.use("/report",reports)
router.use("/roles",roles)
/* Make sure while changing below parentrouter.
This is top level router created to enhance in future like versioning, route prefix etc. */
const parentRouter = express.Router();
parentRouter.use('/v1', router);

export default parentRouter;
