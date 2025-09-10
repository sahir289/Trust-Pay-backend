import { sendCredentialsEmail, sendOTP } from './sendMailer.js';
import { SendEmailCommand } from '@aws-sdk/client-ses';
import { logger } from './logger.js';

// Mock logger to avoid real logging
jest.mock('./logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

// Mock SES client + command
jest.mock('@aws-sdk/client-ses', () => {
  const sendMock = jest.fn();
  return {
    SESClient: jest.fn(() => ({ send: sendMock })),
    SendEmailCommand: jest.fn(), // dummy constructor
    __esModule: true,
    sendMock,
  };
});

const { sendMock } = jest.requireMock('@aws-sdk/client-ses');

describe('sendMailer utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ------------------ sendCredentialsEmail ------------------
  describe('sendCredentialsEmail', () => {
    it('should send credentials email successfully', async () => {
      sendMock.mockResolvedValue({ MessageId: '12345' });

      const result = await sendCredentialsEmail(
        'test@example.com',
        'user123',
        'pass123',
        'code123',
        'secret123',
        'public123'
      );

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(SendEmailCommand).toHaveBeenCalled(); // ensure command constructed
      expect(result).toEqual({ MessageId: '12345' });
      expect(logger.info).toHaveBeenCalledWith(
        'Credentials email sent:',
        expect.objectContaining({ status: 200 })
      );
    });

    it('should log and throw error when SES send fails', async () => {
      const error = new Error('SES send failed');
      sendMock.mockRejectedValue(error);

      await expect(
        sendCredentialsEmail(
          'test@example.com',
          'user123',
          'pass123',
          'code123',
          'secret123',
          'public123'
        )
      ).rejects.toThrow('SES send failed');

      expect(logger.error).toHaveBeenCalledWith('Failed to send credentials email:', error);
    });
  });

  // ------------------ sendOTP ------------------
  describe('sendOTP', () => {
    it('should send OTP email successfully', async () => {
      sendMock.mockResolvedValue({ MessageId: '67890' });

      const result = await sendOTP('otp@example.com', '654321');

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(SendEmailCommand).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
      expect(logger.info).toHaveBeenCalledWith('OTP email sent:', '67890');
    });

    it('should log and throw error when SES send fails', async () => {
      const error = new Error('SES OTP failed');
      sendMock.mockRejectedValue(error);

      await expect(sendOTP('otp@example.com', '654321')).rejects.toThrow('SES OTP failed');

      expect(logger.error).toHaveBeenCalledWith('Failed to send OTP email:', error);
    });
  });
});
