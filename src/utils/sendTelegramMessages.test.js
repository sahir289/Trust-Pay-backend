import * as telegramModule from './sendTelegramMessages.js'; // adjust path
import { createTelegramSender } from '../helpers/telegramApi.js';
import { logger } from './logger.js';
import { getBankResponseDao } from '../apis/bankResponse/bankResponseDao.js';

jest.mock('../helpers/telegramApi.js');
jest.mock('./logger.js');
jest.mock('../apis/bankResponse/bankResponseDao.js');

describe('Telegram Service', () => {
  const chatId = '12345';
  const TELEGRAM_BOT_TOKEN = 'token';
  const replyToMessageId = 'msg1';

  let telegramSenderMock;

  beforeEach(() => {
    jest.clearAllMocks();
    telegramSenderMock = jest.fn().mockResolvedValue(true);
    createTelegramSender.mockReturnValue(telegramSenderMock);
  });

  describe('sendTelegramDashboardReportMessage', () => {
    it('should send 3 messages successfully', async () => {
      const result = await telegramModule.sendTelegramDashboardReportMessage(
        chatId,
        [{ merchantId: 'M1', totalPayin: 1000, totalPayinCount: 1, totalPayout: 500, totalPayoutCount: 1 }],
        1000,
        500,
        { vendor1: { banks: [{ bankName: 'Bank1', TotalDeposit: 1000, TotalCount: 1 }] } },
        { vendor1: { banks: [{ bankName: 'Bank1', TotalDeposit: 500, TotalCount: 1 }] } },
        1000,
        500,
        TELEGRAM_BOT_TOKEN,
        'Daily Report'
      );

      expect(telegramSenderMock).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ success1: true, success2: true, success3: true });
    });
  });

  describe('sendTelegramMerchantDashboardReportMessage', () => {
    it('should send batches correctly', async () => {
      const merchants = Array.from({ length: 25 }, (_, i) => ({ code: `M${i + 1}`, net_balance: 1000 + i }));
      const result = await telegramModule.sendTelegramMerchantDashboardReportMessage(chatId, merchants, TELEGRAM_BOT_TOKEN);
      expect(telegramSenderMock).toHaveBeenCalledTimes(25);
      expect(result).toBe(true);
    });
  });

  describe('sendTelegramVendorDashboardReportMessage', () => {
    it('should send batches correctly', async () => {
      const vendors = Array.from({ length: 22 }, (_, i) => ({ code: `V${i + 1}`, net_balance: 500 + i }));
      const result = await telegramModule.sendTelegramVendorDashboardReportMessage(chatId, vendors, TELEGRAM_BOT_TOKEN);
      expect(telegramSenderMock).toHaveBeenCalledTimes(22);
      expect(result).toBe(true);
    });
  });

  describe('sendTelegramDashboardMerchantGroupingReportMessage', () => {
    it('should send merchant grouping message', async () => {
      const result = await telegramModule.sendTelegramDashboardMerchantGroupingReportMessage(
        chatId,
        1000,
        500,
        10,
        5,
        1000,
        500,
        TELEGRAM_BOT_TOKEN,
        'Daily Report'
      );
      expect(telegramSenderMock).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });
  });

  describe('sendTelegramDashboardSuccessRatioMessage', () => {
    it('should send messages grouped by merchant code', async () => {
      const messages = [
        { merchantCode: 'A1', intervalDetails: 'details', intervalDetailsUtr: 'utr1' },
        { merchantCode: 'A2', intervalDetails: 'details', intervalDetailsUtr: 'utr2' },
        { merchantCode: 'B1', intervalDetails: 'details', intervalDetailsUtr: 'utr3' },
      ];

      await telegramModule.sendTelegramDashboardSuccessRatioMessage(chatId, messages, TELEGRAM_BOT_TOKEN);
      expect(telegramSenderMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('sendTelegramMessage', () => {
    it('should send custom message', async () => {
      const data = { amount: 100, utr: 'UTR1', timeStamp: '2025-09-09' };
      const result = await telegramModule.sendTelegramMessage(chatId, data, TELEGRAM_BOT_TOKEN, replyToMessageId);
      expect(telegramSenderMock).toHaveBeenCalledWith(chatId, expect.stringContaining('UPI-AMOUNT'), replyToMessageId, TELEGRAM_BOT_TOKEN);
      expect(result).toBe(true);
    });
  });

  // Generic test for simple error/success messages
  const simpleMessageFunctions = [
    'sendErrorMessageUtrOrAmountNotFoundImgTelegramBot',
    'sendErrorMessageNoMerchantOrderIdFoundTelegramBot',
    'sendErrorMessageTelegram',
    'sendPaymentStatusMessageTelegramBot',
    'sendUTRMismatchErrorMessageTelegram',
    'sendErrorMessageNoDepositFoundTelegramBot',
    'sendSuccessMessageTelegramBot',
    'sendDisputeMessageTelegramBot',
    'sendDuplicateMessageTelegramBot',
    'sendBankMismatchMessageTelegramBot',
  ];

  simpleMessageFunctions.forEach((funcName) => {
    it(`should call ${funcName} and send message`, async () => {
      const func = telegramModule[funcName];
      const result = await func(chatId, 'param1', TELEGRAM_BOT_TOKEN, replyToMessageId, 'param2', 'param3');
      expect(telegramSenderMock).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('sendAlreadyConfirmedMessageTelegramBot', () => {
    it('should send message for SUCCESS in existingPayinData', async () => {
      const existingPayinData = [{ status: 'SUCCESS', merchant_order_id: 'O1' }];
      const getPayInData = {};
      const result = await telegramModule.sendAlreadyConfirmedMessageTelegramBot(chatId, 'UTR123', TELEGRAM_BOT_TOKEN, replyToMessageId, existingPayinData, getPayInData);
      expect(telegramSenderMock).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should call getBankResponseDao when needed', async () => {
      getBankResponseDao.mockResolvedValue({ utr: 'BANKUTR' });
      const existingPayinData = [{ status: 'FAILED', merchant_order_id: 'O1' }];
      const getPayInData = { status: 'SUCCESS', merchant_order_id: 'O2', bank_response_id: 'id1', company_id: 'comp1' };
      const result = await telegramModule.sendAlreadyConfirmedMessageTelegramBot(chatId, 'UTR456', TELEGRAM_BOT_TOKEN, replyToMessageId, existingPayinData, getPayInData);
      expect(getBankResponseDao).toHaveBeenCalledWith({ id: 'id1', company_id: 'comp1' });
      expect(result).toBe(true);
    });
  });

  describe('sendMerchantOrderIDStatusDuplicateTelegramMessage', () => {
    it('should send duplicate message', async () => {
      const existingPayinData = [{ status: 'SUCCESS', merchant_order_id: 'O1' }];
      const getPayInData = {};
      const result = await telegramModule.sendMerchantOrderIDStatusDuplicateTelegramMessage(chatId, getPayInData, 'UTR123', TELEGRAM_BOT_TOKEN, replyToMessageId, existingPayinData);
      expect(telegramSenderMock).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('sendBankNotAssignedAlertTelegram', () => {
    it('should send bank not assigned alert', async () => {
      await telegramModule.sendBankNotAssignedAlertTelegram(chatId, 'CODE123', TELEGRAM_BOT_TOKEN);
      expect(telegramSenderMock).toHaveBeenCalled();
    });
  });

  describe('sendTelegramDisputeMessage', () => {
    it('should send dispute message', async () => {
      const oldData = { status: 'DISPUTE', amount: 100, upi_short_code: 'UPI1', merchant_order_id: 'O1', id: 'id1', merchant_id: 'M1', user: 'U1' };
      const currentData = { ...oldData };
      const newData = { ...oldData, merchant_order_id: 'O2' };
      await telegramModule.sendTelegramDisputeMessage(chatId, oldData, currentData, newData, 'BANK', 'UTR1', TELEGRAM_BOT_TOKEN);
      expect(telegramSenderMock).toHaveBeenCalled();
    });
  });
});
