import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createVendor, deleteVendor, getVendors, updateVendor } from './vendorController.js';

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
router.post('/', tryCatchHandler(createVendor));
router.get('/', tryCatchHandler(getVendors)); 
router.put('/', tryCatchHandler(updateVendor));
router.put('/', tryCatchHandler(deleteVendor));

export default router;
