import { generateOTP } from './generateOTP.js'; // adjust the path

describe('generateOTP', () => {
  it('should return a 6-digit number', () => {
    const otp = generateOTP();
    expect(typeof otp).toBe('number');
    expect(otp).toBeGreaterThanOrEqual(100000);
    expect(otp).toBeLessThanOrEqual(999999);
  });

  it('should return different OTPs on multiple calls', () => {
    const otp1 = generateOTP();
    const otp2 = generateOTP();
    // There's a very small chance this could fail due to random collision
    expect(otp1).not.toBe(otp2);
  });

  it('should always return an integer', () => {
    const otp = generateOTP();
    expect(Number.isInteger(otp)).toBe(true);
  });
});
