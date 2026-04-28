
import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import config from '../../config/config.js';
import { createGenericPayInWebhookHandler } from './genericPayInWebhookFactory.js';

const router = express.Router();

// Provider-specific config for generic handler
const webhookConfigs = {
	razorpay: {
		getBody: req => req.body.payload?.payment?.entity,
		getMerchantOrderId: body => body?.order_id,
		getUtr: body => body?.id,
		getAmount: body => Number(body?.amount),
		getStatus: body => body?.status === 'authorized' ? 'success' : 'failed',
		verify: () => true // TODO: add signature check
	},
	nmplpay: {
		getBody: req => req.body?.transaction,
		getMerchantOrderId: body => body?.order_id,
		getUtr: body => body?.utr,
		getAmount: body => Number(body?.amount),
		getStatus: body => body?.status,
		verify: () => true // TODO: add hash check
	},
	silkpay: {
		getBody: req => req.body,
		getMerchantOrderId: body => body?.mOrderId,
		getUtr: body => body?.utr,
		getAmount: body => Number(body?.amount),
		getStatus: body => (body?.status === 1 || body?.status === '1') ? 'success' : 'failed',
		verify: () => true // TODO: add hash check
	},
	orvixpay: {
		getBody: req => req.body?.transaction,
		getMerchantOrderId: body => body?.order_id,
		getUtr: body => body?.utr,
		getAmount: body => Number(body?.amount),
		getStatus: body => body?.status,
		verify: () => true // TODO: add hash check
	},
	zentechind: {
		getBody: req => req.body?.transaction,
		getMerchantOrderId: body => body?.order_id,
		getUtr: body => body?.utr,
		getAmount: body => Number(body?.amount),
		getStatus: body => body?.status,
		verify: () => true // TODO: add hash check
	},
	runsafe: {
		getBody: req => typeof req.body === 'string' ? JSON.parse(req.body) : req.body,
		getMerchantOrderId: body => body?.mchOrderNo,
		getUtr: body => body?.utr || body?.mchOrderNo,
		getAmount: body => Number(body?.amount),
		getStatus: body => body?.orderStatus,
		verify: () => true
	},
	cps: {
		getBody: req => typeof req.body === 'string' ? JSON.parse(req.body) : req.body,
		getMerchantOrderId: body => body?.txn_id,
		getUtr: body => body?.utr,
		getAmount: body => Number(body?.amount),
		getStatus: body => body?.status,
		verify: () => true
	},
	tytl: {
		getBody: req => req.body?.data,
		getMerchantOrderId: body => body?.transaction?.order_id,
		getUtr: body => body?.trade?.utr,
		getAmount: body => Number(body?.transaction?.amount),
		getStatus: body => body?.transaction?.status,
		verify: () => true // TODO: add signature check
	},
};

// Add PayEasy variants to webhookConfigs dynamically
Object.keys(config)
	.filter(key => /^payeasy\d*$/.test(key))
	.forEach(routeKey => {
		webhookConfigs[routeKey] = {
			getBody: req => req.body, // Not used, handled in generic handler
			getMerchantOrderId: () => undefined, // Not used
			getUtr: () => undefined, // Not used
			getAmount: () => undefined, // Not used
			getStatus: () => undefined, // Not used
			verify: () => true, // Not used
			encryptionKey: config[routeKey]?.encryptionKey
		};
	});



// Register all webhook routes using the generic handler
Object.entries(webhookConfigs).forEach(([providerKey, providerConfig]) => {
	if (config[`${providerKey.toLowerCase()}`]) {
		router.post(`/${providerKey}`, tryCatchHandler(createGenericPayInWebhookHandler(providerKey, providerConfig)));
	}
});

export default router;
