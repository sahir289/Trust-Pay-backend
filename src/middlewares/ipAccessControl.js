import config from '../config/config.js';
import {AccessDeniedError}from '../utils/appErrors.js';
const parseIpList = (value = '') =>
	value
		.split(',')
		.map((ip) => ip.trim())
		.filter(Boolean);
const getRequestIp = (req) => {
	// Prefer req.ip: with `trust proxy` set, Express derives it from the proxy
	// chain and it cannot be spoofed by a client-supplied X-Forwarded-For. Only
	// fall back to the raw socket address if req.ip is somehow unset.
	const rawIp = req.ip || req.connection?.remoteAddress || '';
	const requestIp = String(rawIp).split(',')[0].trim();
	if (requestIp === '::1') {
		// currently i have added from "config" but in future we can remove this and use only from db and store bank-bots ips
		return config.ipWhitelists.localIp;
	}
	return requestIp;
};
const ipAccessControl = (whitelistKey) => (req, res, next) => {
	// currently i have added from "config" but in future we can remove this and use only from db and store bank-bots ips
	const rawWhitelist = config.ipWhitelists[whitelistKey] || '';
	const whitelist = parseIpList(rawWhitelist);
	const localIp = config.ipWhitelists.localIp;
	if (!whitelist || whitelist.length === 0) {
		return next();
	}
	const requestIp = getRequestIp(req);
	if (requestIp === localIp) {
		return next();
	}
	if (!whitelist.includes(requestIp)) {
		throw new AccessDeniedError('IP not whitelisted');
	}
	return next();
};

export const payoutIpAccessControl = ipAccessControl('payout');
export const payinIpAccessControl = ipAccessControl('payin');