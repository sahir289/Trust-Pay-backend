import crypto from "crypto";

/**
 * Generate HMAC SHA256 signature
 * @param {string} secret - Secret key
 * @param {string} timestamp - Request timestamp
 * @param {string} payload - Payload string (JSON.stringify(payload) if object)
 * @returns {string} Hex signature
 */
export const generateSignature = (secret, timestamp, payload) => {
  const stringToSign = `${timestamp}${payload}`;

  return crypto
    .createHmac("sha256", secret)
    .update(stringToSign, "utf8")
    .digest("hex");
};