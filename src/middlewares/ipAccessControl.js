import config from '../config/config.js';
import {AccessDeniedError}from '../utils/appErrors.js';
const parseIpList = (value = '') =>
	value
		.split(',')
		.map((ip) => ip.trim())
		.filter(Boolean);
const getRequestIp = (req) => {
	const forwardedFor = req.headers['x-forwarded-for'];
	const rawIp = forwardedFor || req.connection?.remoteAddress || req.ip || '';
	const requestIp = String(rawIp).split(',')[0].trim();
	if (requestIp === '::1') {
		return config.ipWhitelists.localIp;
	}
	return requestIp;
};
const ipAccessControl = (whitelistKey) => (req, res, next) => {
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