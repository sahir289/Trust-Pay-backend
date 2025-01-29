import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createChargeBack, deleteChargeBack, getChargeBacks, updateChargeBack } from './chargeBackController.js';

const router = express.Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: users check
 *     description: Returns a status message to verify the user is authorized or not.
 *     tags:
 *       - users Check
 *     responses:
 *       200:
 *         description: login successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "get users successfully"
 */
router.post('/', tryCatchHandler(createChargeBack));
router.get('/', tryCatchHandler(getChargeBacks)); 
router.put('/', tryCatchHandler(updateChargeBack));
router.put('/', tryCatchHandler(deleteChargeBack));

export default router;
