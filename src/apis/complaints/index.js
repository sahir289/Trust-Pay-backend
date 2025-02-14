import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {createComplaints,deleteComplaints,getComplaints,updateComplaints} from "./complaintsController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Complaints
 *   description: Api endpoints for managing complaints
 */

/**
 * @swagger
 * /complaints:
 *   get:
 *     summary: Get all complaints
 *     tags: [Complaints]
 *     responses:
 *       200:
 *         description: A list of complaints
 *       500:
 *         description: Internal server error
 */
router.get('/', tryCatchHandler(getComplaints));

/**
 * @swagger
 * /complaints/create-complaint:
 *   post:
 *     summary: Create a new complaint
 *     tags: [Complaints]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               complaint_type:
 *                 type: string
 *               description:
 *                 type: string
 *               user_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Complaint created successfully
 *       400:
 *         description: Bad request
 */
router.post('/create-complaint', tryCatchHandler(createComplaints));

/**
 * @swagger
 * /complaints/update-complaint/{id}:
 *   put:
 *     summary: Update a complaint
 *     tags: [Complaints]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the complaint to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               complaint_type:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Complaint updated successfully
 *       404:
 *         description: Complaint not found
 */

router.put('/update-complaint/:id', tryCatchHandler(updateComplaints));

/**
 * @swagger
 * /complaints/delete-complaint/{id}:
 *   delete:
 *     summary: Soft delete a complaint
 *     tags: [Complaints]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the complaint to delete
 *     responses:
 *       200:
 *         description: Complaint deleted successfully
 *       404:
 *         description: Complaint not found
 */

router.put('/delete-complaint/:id', tryCatchHandler(deleteComplaints));

export default router;
