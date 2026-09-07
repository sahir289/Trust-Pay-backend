import express from 'express';
import { isAuthenticated, authorized } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
import company from '../company/index.js';
import users from './users/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Super Admin
 *   description: API endpoints restricted to Super Admin role only
 */

// All routes under /super-admin require authentication + SUPER_ADMIN role
router.use(isAuthenticated);
router.use(authorized(AccessRoles.SUPER_ADMIN));

router.use('/company', company);
router.use('/users', users);

export default router;
