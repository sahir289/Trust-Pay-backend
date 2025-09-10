import { sendCredentialsEmail, sendOTP } from './sendMailer.js';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { logger } from '../utils/logger.js';

jest.mock('@aws-sdk/client-ses');
jest.mock('../utils/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

describe('Email Service', () => {
  let sendMock;

  beforeEach(() => {
    jest.clearAllMocks();
    sendMock = jest.fn();
    SESClient.mockImplementation(() => ({ send: sendMock }));
  });

  describe('sendCredentialsEmail', () => {
    it('should send credentials email successfully', async () => {
      sendMock.mockResolvedValue({ messageId: '12345' });

      const data = {
        email: 'test@example.com',
        username: 'user1',
        password: 'pass123',
        code: 'code123',
        secretKey: 'secret',
        publicKey: 'public',
        designation: 'MERCHANT',
      };

      const result = await sendCredentialsEmail(data);

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(result.messageId).toBe('12345');
      expect(logger.info).toHaveBeenCalledWith(
        'Credentials email sent:',
        expect.objectContaining({ status: 200, data: expect.any(Object) }),
      );
    });

    it('should log and throw error if SES send fails', async () => {
      sendMock.mockRejectedValue(new Error('SES error'));

      const data = {
        email: 'test@example.com',
        username: 'user1',
        password: 'pass123',
        designation: 'MERCHANT',
      };

      await expect(sendCredentialsEmail(data)).rejects.toThrow('SES error');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send credentials email:',
        expect.any(Error),
      );
    });
  });

  describe('sendOTP', () => {
    it('should send OTP email successfully', async () => {
      sendMock.mockResolvedValue({ messageId: 'otp123' });

      const result = await sendOTP('test@example.com', '456789', 'user1', 'ADMIN');

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
      expect(logger.info).toHaveBeenCalledWith('OTP email sent:', 'otp123');
    });

    it('should log and throw error if OTP SES send fails', async () => {
      sendMock.mockRejectedValue(new Error('SES error'));

      await expect(sendOTP('test@example.com', '456789', 'user1', 'ADMIN')).rejects.toThrow('SES error');
      expect(logger.error).toHaveBeenCalledWith('Failed to send OTP email:', expect.any(Error));
    });
  });
});
