import { randomInt } from 'node:crypto';

export function generatePassword(user_name) {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = user_name.slice(0, 3);
  let result = prefix;
  for (let i = prefix.length; i < 9; i++) {
    // Cryptographically secure, unbiased character selection.
    result += chars.charAt(randomInt(chars.length));
  }
  return result;
}
