import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {getCalculation,getCalculationById,createCalculation,updateCalculation,deleteCalculation} from './calculationController.js';
import { isAuthenticated } from '../../middlewares/auth.js';
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Calculations
 *   description: API endpoints for managing calculations
 */

/**
 * @swagger
 * /calculations:
 *   get:
 *     summary: Get all calculations
 *     tags: [Calculations]
 *     responses:
 *       200:
 *         description: A list of calculations
 *       500:
 *         description: Internal server error
 */
router.get('/',isAuthenticated, tryCatchHandler(getCalculation));

router.get('/:id',isAuthenticated, tryCatchHandler(getCalculationById));

/**
 * @swagger
 * /calculations/create-calculation:
 *   post:
 *     summary: Create a new calculation
 *     tags: [Calculations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               formula:
 *                 type: string
 *               parameters:
 *                 type: array
 *                 items:
 *                   type: number
 *               created_by:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Calculation created successfully
 *       400:
 *         description: Bad request
 */
router.post('/create-calculation',isAuthenticated, tryCatchHandler(createCalculation));

/**
 * @swagger
 * /calculations/update-calculation/{id}:
 *   put:
 *     summary: Update a calculation
 *     tags: [Calculations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the calculation to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               formula:
 *                 type: string
 *               parameters:
 *                 type: array
 *                 items:
 *                   type: number
 *     responses:
 *       200:
 *         description: Calculation updated successfully
 *       404:
 *         description: Calculation not found
 */
router.put('/update-calculation/:id',isAuthenticated, tryCatchHandler(updateCalculation));

/**
 * @swagger
 * /calculations/delete-calculation/{id}:
 *   delete:
 *     summary: Soft delete a calculation
 *     tags: [Calculations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the calculation to delete
 *     responses:
 *       200:
 *         description: Calculation deleted successfully
 *       404:
 *         description: Calculation not found
 */
router.delete('/delete-calculation/:id',isAuthenticated, tryCatchHandler(deleteCalculation));

export default router;
