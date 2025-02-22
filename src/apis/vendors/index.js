import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createVendor, deleteVendor, getVendors, updateVendor,getVendorById } from './vendorController.js';
import { isAuthenticated } from '../../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * /vendors:
 *   get:
 *     summary: Retrieve all vendors
 *     description: Returns a list of all vendors.
 *     tags:
 *       - Vendors
 *     responses:
 *       200:
 *         description: A list of vendors.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *                     example: "active"
 */
router.get('/', isAuthenticated, tryCatchHandler(getVendors));


router.get('/:id', isAuthenticated, tryCatchHandler(getVendorById));
/**
 * @swagger
 * /vendors/create-vendor:
 *   post:
 *     summary: Create a new vendor
 *     description: Adds a new vendor to the system.
 *     tags:
 *       - Vendors
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Vendor A"
 *               status:
 *                 type: string
 *                 example: "active"
 *     responses:
 *       201:
 *         description: Vendor created successfully.
 *       400:
 *         description: Invalid request data.
 */
router.post('/create-vendor',isAuthenticated ,tryCatchHandler(createVendor));

/**
 * @swagger
 * /vendors/update-vendor/{id}:
 *   put:
 *     summary: Update vendor details
 *     description: Updates an existing vendor’s details.
 *     tags:
 *       - Vendors
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *               status:
 *                 type: string
 *                 example: "inactive"
 *     responses:
 *       200:
 *         description: Vendor updated successfully.
 *       404:
 *         description: Vendor not found.
 */
router.put('/update-vendor/:id', isAuthenticated, tryCatchHandler(updateVendor));

/**
 * @swagger
 * /vendors/delete-vendor/{id}:
 *   delete:
 *     summary: Delete a vendor
 *     description: Soft deletes a vendor by changing its status.
 *     tags:
 *       - Vendors
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
 *         description: Vendor deleted successfully.
 *       404:
 *         description: Vendor not found.
 */
router.delete('/delete-vendor/:id', isAuthenticated, tryCatchHandler(deleteVendor));

export default router;
