import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createUserHierarchy, deleteUserHierarchy, getUserHierarchys, updateUserHierarchy } from './userHierarchyController.js';

const router = express.Router();

/**
 * @swagger
 * /userHierarchys:
 *   get:
 *     summary: Retrieve all userHierarchys
 *     description: Returns a list of all userHierarchys.
 *     tags:
 *       - User Hierarchy
 *     responses:
 *       200:
 *         description: A list of userHierarchys.
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
router.get('/', tryCatchHandler(getUserHierarchys));

/**
 * @swagger
 * /userHierarchys/create-userHierarchy:
 *   post:
 *     summary: Create a new userHierarchy
 *     description: Adds a new userHierarchy to the system.
 *     tags:
 *       - User Hierarchy
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "UserHierarchy A"
 *               status:
 *                 type: string
 *                 example: "active"
 *     responses:
 *       201:
 *         description: UserHierarchy created successfully.
 *       400:
 *         description: Invalid request data.
 */
router.post('/create-userHierarchy', tryCatchHandler(createUserHierarchy));

/**
 * @swagger
 * /userHierarchys/update-userHierarchy:
 *   put:
 *     summary: Update userHierarchy details
 *     description: Updates an existing vendor’s details.
 *     tags:
 *       - User Hierarchy
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
 *         description: UserHierarchy updated successfully.
 *       404:
 *         description: UserHierarchy not found.
 */
router.put('/update-userHierarchy/:id', tryCatchHandler(updateUserHierarchy));

/**
 * @swagger
 * /userHierarchys/delete-userHierarchy:
 *   delete:
 *     summary: Delete a userHierarchy
 *     description: Soft deletes a userHierarchy by changing its status.
 *     tags:
 *       - User Hierarchy
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
 *         description: UserHierarchy deleted successfully.
 *       404:
 *         description: UserHierarchy not found.
 */
router.delete('/delete-userHierarchy/:id', tryCatchHandler(deleteUserHierarchy));

export default router;
