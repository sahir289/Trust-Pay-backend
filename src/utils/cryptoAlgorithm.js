import crypto from 'crypto';

export const crypto512Algo = (x_api_key, payinId, merchant_order_id) => {
  const salt = crypto.randomBytes(256).toString('hex');
  const hashString = `${x_api_key}|${payinId}|${merchant_order_id}|${salt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
};
