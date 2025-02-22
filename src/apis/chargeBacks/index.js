import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createChargeBack, deleteChargeBack, getChargeBacks, updateChargeBack,getChargeBacksById } from './chargeBackController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * /chargeBacks:
 *   get:
 *     summary: Get all chargebacks
 *     description: Fetches all chargebacks from the system.
 *     tags:
 *       - ChargeBacks
 *     responses:
 *       200:
 *         description: Successfully retrieved chargebacks.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "get chargeBacks successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/', [isAuthenticated, authorized(AccessRoles.CHAREBACK)], tryCatchHandler(getChargeBacks));
router.get('/:id', [isAuthenticated, authorized(AccessRoles.CHAREBACK)], tryCatchHandler(getChargeBacksById));

/**
 * @swagger
 * /chargeBacks/create-chargeback:
 *   post:
 *     summary: Create a chargeback
 *     description: Adds a new chargeback to the system.
 *     tags:
 *       - ChargeBacks
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Chargeback created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Chargeback created successfully"
 */
router.post('/create-chargeback', [isAuthenticated, authorized(AccessRoles.CHAREBACK)], tryCatchHandler(createChargeBack));

/**
 * @swagger
 * /chargeBacks/update-chargeback/{id}:
 *   put:
 *     summary: Update a chargeback
 *     description: Updates an existing chargeback in the system.
 *     tags:
 *       - ChargeBacks
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               amount:
 *                 type: number
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Chargeback updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Chargeback updated successfully"
 */
router.put('/update-chargeback/:id', [isAuthenticated, authorized(AccessRoles.CHAREBACK)], tryCatchHandler(updateChargeBack));

/**
 * @swagger
 * /chargeBacks/delete-chargeback/{id}:
 *   delete:
 *     summary: Delete a chargeback
 *     description: Marks a chargeback as deleted in the system.
 *     tags:
 *       - ChargeBacks
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Chargeback deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Chargeback deleted successfully"
 */
router.delete('/delete-chargeback/:id', [isAuthenticated, authorized(AccessRoles.CHAREBACK)], tryCatchHandler(deleteChargeBack));

export default router;