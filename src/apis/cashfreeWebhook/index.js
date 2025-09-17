import express from 'express';
import { cashfreeWebHook } from '../../webhooks/cashfree.js';
import tryCatchHandler from '../../utils/tryCatchHandler.js';

const router = express.Router();

router.post('/cashfree', express.raw({ type: "application/json" }), tryCatchHandler(cashfreeWebHook));

export default router;