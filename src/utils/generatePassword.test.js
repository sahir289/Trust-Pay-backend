import { generatePassword } from './generatePassword.js'; // adjust path

describe('generatePassword', () => {
  it('should start with first 3 letters of the username', () => {
    const username = 'JyotiS';
    const password = generatePassword(username);
    expect(password.slice(0, 3)).toBe(username.slice(0, 3));
  });

  it('should have a total length of 9 characters', () => {
    const username = 'User123';
    const password = generatePassword(username);
    expect(password.length).toBe(9);
  });

  it('should contain only alphanumeric characters after prefix', () => {
    const username = 'abc';
    const password = generatePassword(username);
    const suffix = password.slice(3);
    expect(/^[A-Za-z0-9]+$/.test(suffix)).toBe(true);
  });

  it('should generate different passwords on multiple calls', () => {
    const username = 'TestUser';
    const password1 = generatePassword(username);
    const password2 = generatePassword(username);
    expect(password1).not.toBe(password2); // Randomized
  });
});
