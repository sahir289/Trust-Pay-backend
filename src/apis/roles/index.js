import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { getRoles ,createRole,updateRole ,deleteRole } from './rolesController.js';
const router = express.Router();


router.get('/', tryCatchHandler(getRoles));

router.post('/create-role', tryCatchHandler(createRole));

router.put('/update-role', tryCatchHandler(updateRole));

router.put('/delete-role', tryCatchHandler(deleteRole));



export default router;