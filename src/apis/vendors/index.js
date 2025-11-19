import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createVendor,
  deleteVendor,
  getVendors,
  updateVendor,
  getVendorById,
  getVendorCodes,
  getVendorsBySearch,
  getBankResponseAccessByID,
  getVendorByCode,
  linkVendor,
  unlinkVendor,
  transferVendor,
} from './vendorController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Vendors
 *   description: API endpoints for managing vendors
 */

/**
 * @swagger
 * /vendors:
 *   get:
 *     summary: Retrieve all vendors
 *     description: Returns a list of all vendors.
 *     tags: [Vendors]
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

router.get(
  '/get',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(getVendors),
);
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(getVendorsBySearch),
);
/**
 * @swagger
 * /vendors:
 *   get:
 *     summary: Retrieve all vendors
 *     description: Returns a list of all vendors.
 *     tags: [Vendors]
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
router.get(
  '/codes',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(getVendorCodes),
);

/**
 * @swagger
 * /vendors/get-vendor-by-code:
 *   get:
 *     summary: Get vendor by code
 *     description: Retrieves a vendor by their unique code.
 *     tags: [Vendors]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         description: The unique code of the vendor.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vendor details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         description: Vendor not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/get-vendor-by-code',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(getVendorByCode),
);

/**
 * @swagger
 * /vendors/{id}:
 *   get:
 *     summary: Get vendor by ID
 *     description: Fetches details of a vendor by its ID.
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the vendor to fetch.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vendor details.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: "active"
 *       404:
 *         description: Vendor not found.
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(getVendorById),
);

/**
 * @swagger
 * /vendors/get-bankresponse-access/{id}:
 *   get:
 *     summary: Get bank response access for vendor
 *     description: Retrieves bank response access permissions for a specific vendor.
 *     tags: [Vendors]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the vendor.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bank response access details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         description: Vendor not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/get-bankresponse-access/:id',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(getBankResponseAccessByID),
);

/**
 * @swagger
 * /vendors/create-vendor:
 *   post:
 *     summary: Create a new vendor
 *     description: Adds a new vendor to the system.
 *     tags: [Vendors]
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
router.post(
  '/create-vendor',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(createVendor),
);

/**
 * @swagger
 * /vendors/update-vendor/{id}:
 *   put:
 *     summary: Update vendor details
 *     description: Updates an existing vendor’s details.
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the vendor to update.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
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
router.put(
  '/update-vendor/:id',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(updateVendor),
);

/**
 * @swagger
 * /vendors/delete-vendor/{id}:
 *   delete:
 *     summary: Delete a vendor
 *     description: Soft deletes a vendor by changing its status.
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the vendor to delete.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vendor deleted successfully.
 *       404:
 *         description: Vendor not found.
 */
router.delete(
  '/delete-vendor/:user_id',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(deleteVendor),
);

/**
 * @swagger
 * /vendors/link-vendor:
 *   post:
 *     summary: Link vendor to hierarchy
 *     description: Links a vendor to a parent vendor or hierarchy.
 *     tags: [Vendors]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vendorId
 *               - parentVendorId
 *             properties:
 *               vendorId:
 *                 type: string
 *                 example: "vendor_123"
 *               parentVendorId:
 *                 type: string
 *                 example: "parent_vendor_456"
 *     responses:
 *       200:
 *         description: Vendor linked successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Vendor not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/link-vendor',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(linkVendor),
);
/**
 * @swagger
 * /vendors/unlink-vendor:
 *   post:
 *     summary: Unlink vendor from hierarchy
 *     description: Removes a vendor from its current hierarchy.
 *     tags: [Vendors]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vendorId
 *             properties:
 *               vendorId:
 *                 type: string
 *                 example: "vendor_123"
 *     responses:
 *       200:
 *         description: Vendor unlinked successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         description: Vendor not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/unlink-vendor',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(unlinkVendor),
);
/**
 * @swagger
 * /vendors/transfer-vendor:
 *   post:
 *     summary: Transfer vendor to different hierarchy
 *     description: Transfers a vendor from one parent to another.
 *     tags: [Vendors]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vendorId
 *               - newParentVendorId
 *             properties:
 *               vendorId:
 *                 type: string
 *                 example: "vendor_123"
 *               newParentVendorId:
 *                 type: string
 *                 example: "new_parent_vendor_789"
 *     responses:
 *       200:
 *         description: Vendor transferred successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Vendor not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/transfer-vendor',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(transferVendor),
);

export default router;
