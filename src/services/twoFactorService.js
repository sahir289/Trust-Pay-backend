import { generateSecret, verifySync } from 'otplib';
import { TOTP } from '@otplib/totp';
import qrcode from 'qrcode';
import { logger } from '../utils/logger.js';

export const APP_NAME = process.env.APP_NAME || 'Application';

/**
 * Generates a TOTP secret and a QR code data URL for the given username.
 * The QR code can be scanned directly by Google Authenticator.
 *
 * @param {string} username - The user's username (used as the account label)
 * @returns {Promise<{ secret: string, qrCodeDataUrl: string }>}
 */
const generateSetup = async (username) => {
  try {
    // Validate username to prevent "undefined" or "null" in QR code
    if (!username || username === 'undefined' || username === 'null') {
      throw new Error('Invalid username provided for 2FA setup');
    }
    
    const secret = generateSecret();
    const totp = new TOTP();
    const otpAuthUrl = totp.toURI({ label: username, issuer: APP_NAME, secret });
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
    return verifySync({ token, secret });
  } catch (error) {
    logger.error('Error verifying 2FA token:', error);
    return false;
  }
};

export { generateSetup, verifyTotpToken };
