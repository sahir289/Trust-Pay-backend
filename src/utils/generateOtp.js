import { randomInt } from 'node:crypto';

export function generateOTP() {
  // Cryptographically secure, unbiased 6-digit OTP (100000–999999).
  return randomInt(100000, 1000000);
}
