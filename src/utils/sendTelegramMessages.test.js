const {
  sendAlreadyConfirmedMessageTelegramBot,
  sendMerchantOrderIDStatusDuplicateTelegramMessage,
} = require('../utils/sendTelegramMessages');
const { createTelegramSender } = require('../helpers/telegramApi');
const { logger } = require('../utils/logger');
const axios = require('axios');

// Mock dependencies
jest.mock('axios');
jest.mock('../helpers/telegramApi');
jest.mock('../utils/logger');

// Mock logger methods
logger.log = jest.fn();
logger.info = jest.fn();
logger.error = jest.fn();

// Mock telegramSender
const mockTelegramSender = jest.fn();
createTelegramSender.mockReturnValue(mockTelegramSender);

// Sample data for testing
const mockChatId = '123456';
const mockToken = 'mock-telegram-bot-token';
const mockPayInData = {
  merchant_order_id: 'ORDER123',
  user_submitted_utr: '1234567890',
  status: 'SUCCESS',
  bank_response_id: 'BANK123',
  company_id: 'COMP123',
};
const mockExistingPayInData = [
  { status: 'SUCCESS', merchant_order_id: 'ORDER123' },
];

describe('Telegram Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTelegramSender.mockReset();
    mockTelegramSender.mockImplementation(async () => true); // Default implementation
    createTelegramSender.mockReturnValue(mockTelegramSender); // Ensure mock returns function
  });

  describe('Error and Status Message Functions', () => {
    it('should handle success status with existing payin data', async () => {
      // Ensure mock is set correctly
      expect(createTelegramSender).toBeDefined();
      expect(createTelegramSender()).toBe(mockTelegramSender);
      expect(mockTelegramSender).toBeInstanceOf(Function);

      mockTelegramSender.mockResolvedValue(true);

      const result = await sendAlreadyConfirmedMessageTelegramBot(
        mockChatId,
        '1234567890',
        mockToken,
        123,
        mockExistingPayInData,
        mockPayInData
      );

      expect(mockTelegramSender).toHaveBeenCalledWith(
        mockChatId,
        '✅ UTR 1234567890 is already confirmed with this orderId ORDER123',
        123,
        mockToken
      );
      expect(logger.log).toHaveBeenCalledWith('Sent!');
      expect(result).toBe(true);
    });

    it('should handle success status with payin data', async () => {
      // Ensure mock is set correctly
      expect(createTelegramSender).toBeDefined();
      expect(createTelegramSender()).toBe(mockTelegramSender);
      expect(mockTelegramSender).toBeInstanceOf(Function);

      mockTelegramSender.mockResolvedValue(true);

      const result = await sendAlreadyConfirmedMessageTelegramBot(
        mockChatId,
        '1234567890',
        mockToken,
        123,
        [],
        mockPayInData
      );

      expect(mockTelegramSender).toHaveBeenCalledWith(
        mockChatId,
        '✅ Merchant Order ID: ORDER123\n                  is Already Confirmed with UTR: 1234567890',
        123,
        mockToken
      );
      expect(logger.log).toHaveBeenCalledWith('Sent!');
      expect(result).toBe(true);
    });

    it('should handle success status for duplicate order ID', async () => {
      // Ensure mock is set correctly
      expect(createTelegramSender).toBeDefined();
      expect(createTelegramSender()).toBe(mockTelegramSender);
      expect(mockTelegramSender).toBeInstanceOf(Function);

      mockTelegramSender.mockResolvedValue(true);

      const result = await sendMerchantOrderIDStatusDuplicateTelegramMessage(
        mockChatId,
        mockPayInData,
        '1234567890',
        mockToken,
        123,
        mockExistingPayInData
      );

      expect(mockTelegramSender).toHaveBeenCalledWith(
        mockChatId,
        '✅ UTR 1234567890 is already confirmed with this orderId ORDER123',
        123,
        mockToken
      );
      expect(logger.log).toHaveBeenCalledWith('Sent!');
      expect(result).toBe(true);
    });
  });
});