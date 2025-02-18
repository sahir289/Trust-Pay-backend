import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createUserHierarchy, deleteUserHierarchy, getUserHierarchys, updateUserHierarchy,getUserHierarchysById } from './userHierarchyController.js';
import { isAuthenticated } from '../../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * /userHierarchy:
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
router.get('/getAll', isAuthenticated, tryCatchHandler(getUserHierarchys));
router.get('/:id', isAuthenticated, tryCatchHandler(getUserHierarchysById));

/**
 * @swagger
 * /userHierarchy/create-userHierarchy:
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
router.post('/create-userHierarchy', isAuthenticated, tryCatchHandler(createUserHierarchy));

/**
 * @swagger
 * /userHierarchy/update-userHierarchy:
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
router.put('/update-userHierarchy/:id', isAuthenticated, tryCatchHandler(updateUserHierarchy));

/**
 * @swagger
 * /userHierarchy/delete-userHierarchy:
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
router.delete('/delete-userHierarchy/:id', isAuthenticated, tryCatchHandler(deleteUserHierarchy));

export default router;
