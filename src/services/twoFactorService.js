import { generateSecret, generateURI, verifySync } from 'otplib';
import qrcode from 'qrcode';
import { logger } from '../utils/logger.js';

const APP_NAME = 'TrustPay';

/**
 * Generates a TOTP secret and a QR code data URL for the given username.
 * The QR code can be scanned directly by Google Authenticator.
 *
 * @param {string} username - The user's username (used as the account label)
 * @returns {Promise<{ secret: string, qrCodeDataUrl: string }>}
 */
const generateSetup = async (username) => {
  try {
    const secret = generateSecret();
    const otpAuthUrl = generateURI({ secret, account: username, issuer: APP_NAME });
    const qrCodeDataUrl = await qrcode.toDataURL(otpAuthUrl);
    return { secret, qrCodeDataUrl };
  } catch (error) {
    logger.error('Error generating 2FA setup:', error);
    throw error;
  }
};

/**
 * Verifies a 6-digit TOTP token against the stored secret.
 *
 * @param {string} token - 6-digit OTP from Google Authenticator
 * @param {string} secret - The base32 secret stored for this user
 * @returns {boolean}
 */
const verifyTotpToken = (token, secret) => {
  try {
    const result = verifySync({ token, secret });
    return result ? result.valid === true : false;
  } catch (error) {
    logger.error('Error verifying 2FA token:', error);
    return false;
  }
};

export { generateSetup, verifyTotpToken };
