import { generateUniqueCode } from './uniqueIdGenerator'; 

describe('generateUniqueCode', () => {
  test('should return a string in the format xxxx-xxxx-xxxx-xxxx', () => {
    const code = generateUniqueCode();

    // Check the general pattern
    expect(code).toMatch(/^\d{4}-\d{4}-\d{4}-\d{4}$/);

    // Check length including hyphens
    expect(code.length).toBe(19);

    // Check only digits and hyphens
    expect(/^[\d-]+$/.test(code)).toBe(true);
  });

  test('should generate different codes on multiple calls', () => {
    const code1 = generateUniqueCode();
    const code2 = generateUniqueCode();

    expect(code1).not.toBe(code2);
  });

  test('should have exactly 16 digits', () => {
    const code = generateUniqueCode();
    const digitsOnly = code.replace(/-/g, '');
    expect(digitsOnly.length).toBe(16);
  });
});
