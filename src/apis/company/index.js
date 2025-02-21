import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createCompany, deleteCompany, getCompany, updateCompany } from './companyController.js';
import { isAuthenticated } from '../../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * /company:
 *   get:
 *     summary: Get Company by ID
 *     description: Retrieves details of a specific company by its ID.
 *     tags:
 *       - Company
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the company to retrieve.
 *     responses:
 *       200:
 *         description: Company details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Company retrieved successfully"
 *                 data:
 *                   type: object
 */
router.get('/', isAuthenticated, tryCatchHandler(getCompany));


/**
 * @swagger
 * /company/create-company:
 *   post:
 *     summary: Create a new Company
 *     description: Creates a new company with the provided details.
 *     tags:
 *       - Company
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName:
 *                 type: string
 *                 example: "Tech Solutions Ltd."
 *     responses:
 *       201:
 *         description: Company created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Company created successfully"
 *                 data:
 *                   type: object
 */
router.post('/create-company',isAuthenticated, tryCatchHandler(createCompany));


/**
 * @swagger
 * /company/update-company/{id}:
 *   put:
 *     summary: Update an existing Company
 *     description: Updates the details of a specific company by ID.
 *     tags:
 *       - Company
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the company to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName:
 *                 type: string
 *                 example: "Updated Company Name"
 *     responses:
 *       200:
 *         description: Company updated successfully.
 */
router.put('/update-company/:id',isAuthenticated,  tryCatchHandler(updateCompany));


/**
 * @swagger
 * /company/delete-company/{id}:
 *   delete:
 *     summary: Delete a Company
 *     description: Deletes a company by ID.
 *     tags:
 *       - Company
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the company to delete.
 *     responses:
 *       200:
 *         description: Company deleted successfully.
 */
router.delete('/delete-company/:id', isAuthenticated, tryCatchHandler(deleteCompany));



export default router;
