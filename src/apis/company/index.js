import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createCompany,
  deleteCompany,
  getCompany,
  updateCompany,
  getCompanyById,
} from './companyController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Company
 *   description: API endpoints for managing company data
 */

/**
 * @swagger
 * /company:
 *   get:
 *     summary: Get all companies
 *     description: Retrieve a list of all companies with pagination support.
 *     tags: [Company]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *         description: Number of companies per page
 *     responses:
 *       200:
 *         description: Companies retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.COMPANY)],
  tryCatchHandler(getCompany),
);

/**
 * @swagger
 * /company/{id}:
 *   get:
 *     summary: Get a company by ID
 *     description: Retrieves details of a specific company by its ID.
 *     tags: [Company]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
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
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     companyName:
 *                       type: string
 *                       example: "Tech Solutions Ltd."
 *       404:
 *         description: Company not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.COMPANY)],
  tryCatchHandler(getCompanyById),
);

/**
 * @swagger
 * /company/create-company:
 *   post:
 *     summary: Create a new company
 *     description: Creates a new company with the provided details.
 *     tags: [Company]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyName
 *             properties:
 *               companyName:
 *                 type: string
 *                 description: Name of the company
 *                 example: "Tech Solutions Ltd."
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Company contact email
 *                 example: "contact@techsolutions.com"
 *               phone:
 *                 type: string
 *                 description: Company phone number
 *                 example: "+91-9876543210"
 *               address:
 *                 type: string
 *                 description: Company address
 *                 example: "123 Business Park, Mumbai, Maharashtra, India"
 *               website:
 *                 type: string
 *                 format: uri
 *                 description: Company website URL
 *                 example: "https://techsolutions.com"
 *               business_type:
 *                 type: string
 *                 description: Type of business
 *                 example: "Technology Services"
 *     responses:
 *       201:
 *         description: Company created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Bad request (validation error)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/create-company', tryCatchHandler(createCompany));

/**
 * @swagger
 * /company/update-company/{id}:
 *   put:
 *     summary: Update an existing company
 *     description: Updates the details of a specific company by ID.
 *     tags: [Company]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Company updated successfully"
 *       400:
 *         description: Bad request (validation error)
 *       404:
 *         description: Company not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/update-company/:id',
  [isAuthenticated, authorized(AccessRoles.COMPANY)],
  tryCatchHandler(updateCompany),
);

/**
 * @swagger
 * /company/delete-company/{id}:
 *   delete:
 *     summary: Delete a company
 *     description: Deletes a company by ID.
 *     tags: [Company]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the company to delete.
 *     responses:
 *       200:
 *         description: Company deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Company deleted successfully"
 *       404:
 *         description: Company not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/delete-company/:id',
  [isAuthenticated, authorized(AccessRoles.COMPANY)],
  tryCatchHandler(deleteCompany),
);

export default router;
