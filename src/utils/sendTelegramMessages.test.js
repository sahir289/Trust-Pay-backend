// src/utils/sendTelegramMessages.test.js

// Define the mock function for telegramSender
const telegramSenderMock = jest.fn();

// Use jest.doMock to avoid hoisting issues with telegramSenderMock
jest.doMock('../helpers/telegramApi', () => ({
  createTelegramSender: jest.fn().mockReturnValue(telegramSenderMock),
}));
jest.mock('../utils/logger');
jest.mock('../apis/bankResponse/bankResponseDao');

const {
  sendTelegramDashboardReportMessage,
  sendTelegramMerchantDashboardReportMessage,
  sendTelegramVendorDashboardReportMessage,
  sendTelegramDashboardSuccessRatioMessage,
  sendTelegramMessage,
  sendErrorMessageUtrOrAmountNotFoundImgTelegramBot,
  sendErrorMessageNoMerchantOrderIdFoundTelegramBot,
  sendErrorMessageTelegram,
  sendPaymentStatusMessageTelegramBot,
  sendUTRMismatchErrorMessageTelegram,
  sendErrorMessageNoDepositFoundTelegramBot,
  sendSuccessMessageTelegramBot,
  sendDisputeMessageTelegramBot,
  sendDuplicateMessageTelegramBot,
  sendBankMismatchMessageTelegramBot,
  sendAlreadyConfirmedMessageTelegramBot,
  sendMerchantOrderIDStatusDuplicateTelegramMessage,
  sendBankNotAssignedAlertTelegram,
  sendTelegramDisputeMessage,
} = require('./sendTelegramMessages');

const { logger } = require('../utils/logger');
const { getBankResponseDao } = require('../apis/bankResponse/bankResponseDao');

describe('Telegram Dashboard Functions', () => {
  beforeEach(() => {
    // Reset mocks and set default behavior
    telegramSenderMock.mockReset().mockResolvedValue(true);
    getBankResponseDao.mockReset();
    logger.log.mockReset();
    logger.error.mockReset();
    logger.info.mockReset();
  });

  describe('sendTelegramDashboardReportMessage', () => {
    test('should send three messages with formatted financial data', async () => {
      const mockParams = {
        chatId: 'chat123',
        merchant: [
          { merchantId: 'M1', totalPayin: 1000, totalPayinCount: 10, totalPayout: 500, totalPayoutCount: 5 },
        ],
        totalpayinsMerchant: 1000,
        totalpayoutsMerchant: 500,
        vendorObjpayIn: {
          V1: { banks: [{ bankName: 'Bank1', TotalDeposit: 1000, TotalCount: 10 }] },
        },
        vendorObjpayOut: {
          V1: { banks: [{ bankName: 'Bank1', TotalDeposit: 500, TotalCount: 5 }] },
        },
        totalBankDepositAllVendors: 1000,
        totalBankWithdrawalAllVendors: 500,
        TELEGRAM_BOT_TOKEN: 'test-token',
        type: 'Hourly Report',
        date: '2025-09-13',
      };

      const result = await sendTelegramDashboardReportMessage(...Object.values(mockParams));

      expect(telegramSenderMock).toHaveBeenCalledTimes(3);
      // Check that each call contains the expected substrings
      const calls = telegramSenderMock.mock.calls;
      expect(calls[0][1]).toEqual(expect.stringContaining('Deposits'));
      expect(calls[1][1]).toEqual(expect.stringContaining('Bank Account Deposits'));
      expect(calls[2][1]).toEqual(expect.stringContaining('Bank Account Withdrawals'));
      expect(result).toEqual({ success1: true, success2: [true], success3: [true] });
      expect(logger.log).toHaveBeenCalledTimes(3);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Sent message1!'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Sent message2'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Sent message3'));
    });

    test('should handle failed message sends', async () => {
      telegramSenderMock
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const mockParams = {
        chatId: 'chat123',
        merchant: [
          { merchantId: 'M1', totalPayin: 1000, totalPayinCount: 10, totalPayout: 500, totalPayoutCount: 5 },
        ],
        totalpayinsMerchant: 1000,
        totalpayoutsMerchant: 500,
        vendorObjpayIn: {
          V1: { banks: [{ bankName: 'Bank1', TotalDeposit: 1000, TotalCount: 10 }] },
        },
        vendorObjpayOut: {
          V1: { banks: [{ bankName: 'Bank1', TotalDeposit: 500, TotalCount: 5 }] },
        },
        totalBankDepositAllVendors: 1000,
        totalBankWithdrawalAllVendors: 500,
        TELEGRAM_BOT_TOKEN: 'test-token',
        type: 'Hourly Report',
        date: '2025-09-13',
      };

      const result = await sendTelegramDashboardReportMessage(...Object.values(mockParams));

      expect(telegramSenderMock).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ success1: true, success2: [false], success3: [true] });
      // expect(logger.log).toHaveBeenCalledWith('Not sent.');
      expect(logger.log).toHaveBeenCalledTimes(3);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Sent message1!'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Not sent: message2 (Part 1).'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Sent message3 (Part 1)!'));

    });
  });

  describe('sendTelegramMerchantDashboardReportMessage', () => {
    test('should send batched merchant balance messages', async () => {
      const merchantBalanceData = Array(25).fill().map((_, i) => ({
        code: `M${i}`,
        net_balance: 1000 + i,
      }));

      const result = await sendTelegramMerchantDashboardReportMessage(
        'chat123',
        merchantBalanceData,
        'test-token'
      );

      expect(telegramSenderMock).toHaveBeenCalledTimes(2); // 25 merchants, batch size 20, so 2 batches
      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('<b>Merchant Dashboard Report</b> (1/2)'),
        null,
        'test-token'
      );


      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('<b>Merchant Dashboard Report</b> (2/2)'),
        null,
        'test-token'
      );

      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Batch 1/2: Sent!');
      expect(logger.log).toHaveBeenCalledWith('Batch 2/2: Sent!');
    });

    test('should send batched merchant balance messages line by line', async () => {
      const merchantBalanceData = Array(25).fill().map((_, i) => ({
        code: `M${i}`,
        net_balance: 1000 + i,
      }));

      await sendTelegramMerchantDashboardReportMessage('chat123', merchantBalanceData, 'test-token');

      expect(telegramSenderMock).toHaveBeenCalledTimes(2); // 25 merchants, batch size 20 => 2 messages

      // Build expected lines for batch 1
      const batch1Lines = merchantBalanceData.slice(0, 20).map(m =>
        `<b>${m.code}:</b> <b>Net Balance:</b> ₹ ${m.net_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      );
      batch1Lines.unshift('<b>Merchant Dashboard Report</b> (1/2)'); // header

      // Build expected lines for batch 2
      const batch2Lines = merchantBalanceData.slice(20).map(m =>
        `<b>${m.code}:</b> <b>Net Balance:</b> ₹ ${m.net_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      );
      batch2Lines.unshift('<b>Merchant Dashboard Report</b> (2/2)'); // header

      // Split actual calls by lines
      const actualBatch1Lines = telegramSenderMock.mock.calls[0][1].split('\n').map(l => l.trim()).filter(Boolean);
      const actualBatch2Lines = telegramSenderMock.mock.calls[1][1].split('\n').map(l => l.trim()).filter(Boolean);

      expect(actualBatch1Lines).toEqual(batch1Lines);
      expect(actualBatch2Lines).toEqual(batch2Lines);
    });

    test('should handle errors and return false', async () => {
      telegramSenderMock.mockRejectedValueOnce(new Error('Network error'));

      const result = await sendTelegramMerchantDashboardReportMessage(
        'chat123',
        [{ code: 'M1', net_balance: 1000 }],
        'test-token'
      );

      expect(telegramSenderMock).toHaveBeenCalledTimes(1);
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Error in sendTelegramMerchantDashboardReportMessage:',
        'Network error'
      );
    });
  });

  describe('sendTelegramVendorDashboardReportMessage', () => {
    test('should send batched vendor balance messages', async () => {
      const vendorBalanceData = Array(25).fill().map((_, i) => ({
        code: `V${i}`,
        net_balance: 1000 + i,
      }));

      const result = await sendTelegramVendorDashboardReportMessage(
        'chat123',
        vendorBalanceData,
        'test-token'
      );

      expect(telegramSenderMock).toHaveBeenCalledTimes(2); // 25 vendors, batch size 20, so 2 batches
      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('<b>Vendor Dashboard Report</b> (1/2)'),
        null,
        'test-token'
      );
      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('<b>Vendor Dashboard Report</b> (2/2)'),
        null,
        'test-token'
      );

      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Batch 1/2: Sent!');
      expect(logger.log).toHaveBeenCalledWith('Batch 2/2: Sent!');
    });
    test('should send batched vendor balance messages line by line', async () => {
      const vendorBalanceData = Array(25).fill().map((_, i) => ({
        code: `V${i}`,
        net_balance: 1000 + i,
      }));

      await sendTelegramVendorDashboardReportMessage('chat123', vendorBalanceData, 'test-token');

      expect(telegramSenderMock).toHaveBeenCalledTimes(2);

      // Build expected lines for batch 1
      const batch1Lines = vendorBalanceData.slice(0, 20).map(v =>
        `<b>${v.code}:</b> <b>Net Balance:</b> ₹ ${v.net_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      );
      batch1Lines.unshift('<b>Vendor Dashboard Report</b> (1/2)');

      // Build expected lines for batch 2
      const batch2Lines = vendorBalanceData.slice(20).map(v =>
        `<b>${v.code}:</b> <b>Net Balance:</b> ₹ ${v.net_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      );
      batch2Lines.unshift('<b>Vendor Dashboard Report</b> (2/2)');

      const actualBatch1Lines = telegramSenderMock.mock.calls[0][1].split('\n').map(l => l.trim()).filter(Boolean);
      const actualBatch2Lines = telegramSenderMock.mock.calls[1][1].split('\n').map(l => l.trim()).filter(Boolean);

      expect(actualBatch1Lines).toEqual(batch1Lines);
      expect(actualBatch2Lines).toEqual(batch2Lines);
    });
  });

  describe('sendTelegramDashboardSuccessRatioMessage', () => {
    test('should send grouped success ratio messages', async () => {
      const fullMessages = [
        { merchantCode: 'A1', intervalDetails: 'Details1', intervalDetailsUtr: 'UtrDetails1' },
        { merchantCode: 'B1', intervalDetails: 'Details2', intervalDetailsUtr: 'UtrDetails2' },
      ];

      await sendTelegramDashboardSuccessRatioMessage('chat123', fullMessages, 'test-token');

      expect(telegramSenderMock).toHaveBeenCalledTimes(2); // 2 messages, one for each merchant
      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('🔔 <b>A1</b> - SR 🔔'),
        null,
        'test-token'
      );
      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('🔔 <b>B1</b> - SR 🔔'),
        null,
        'test-token'
      );
      expect(logger.info).toHaveBeenCalledWith('Finished sending all messages to Telegram');
    });
  });

  describe('sendTelegramMessage', () => {
    test('should send formatted UPI message', async () => {
      const data = { amount: 1000, utr: '123456', timeStamp: '2025-09-13' };
      const result = await sendTelegramMessage('chat123', data, 'test-token', 456);

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringMatching(/<b>UPI-AMOUNT:<\/b>\s*1000/),
        456,
        'test-token'
      );

      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });
  });

  describe('sendErrorMessageUtrOrAmountNotFoundImgTelegramBot', () => {
    test('should send error message for UTR or amount not found', async () => {
      const result = await sendErrorMessageUtrOrAmountNotFoundImgTelegramBot(
        'chat123',
        'test-token',
        456
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        '⛔ Please check this slip ',
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });
  });

  describe('sendErrorMessageNoMerchantOrderIdFoundTelegramBot', () => {
    test('should send error message for no merchant order ID with image', async () => {
      const result = await sendErrorMessageNoMerchantOrderIdFoundTelegramBot(
        'chat123',
        'test-token',
        456,
        false
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        '⛔ Please mention Merchant Order Id',
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });

    test('should send error message for no merchant order ID without image', async () => {
      const result = await sendErrorMessageNoMerchantOrderIdFoundTelegramBot(
        'chat123',
        'test-token',
        456,
        true
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        '⛔ Please mention Merchant Order Id in Caption',
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });
  });

  describe('sendErrorMessageTelegram', () => {
    test('should send error message for invalid merchant order ID', async () => {
      const result = await sendErrorMessageTelegram(
        'chat123',
        'MO123',
        'test-token',
        456
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        '⛔ No Merchant Order ID MO123 found. Please recheck input',
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });
  });

  describe('sendPaymentStatusMessageTelegramBot', () => {
    test('should send payment status message', async () => {
      const result = await sendPaymentStatusMessageTelegramBot(
        'chat123',
        'MO123',
        'test-token',
        456,
        'SUCCESS'
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        '⛔ Payment for Merchant Order ID MO123 has already SUCCESS.',
        456,
        'test-token'
      );
      expect(result).toBe(true);
      // expect(logger.log).toHaveBeenCalledWith('Sent!');
    });
  });

  describe('sendUTRMismatchErrorMessageTelegram', () => {
    test('should send UTR mismatch error message', async () => {
      const result = await sendUTRMismatchErrorMessageTelegram(
        'chat123',
        'UTR123',
        'UTR456',
        'test-token',
        456
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        '⛔ UTR - UTR123 does not match with the UTR submitted by the user - UTR456',
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });
  });

  describe('sendErrorMessageNoDepositFoundTelegramBot', () => {
    test('should send no deposit found error message', async () => {
      const result = await sendErrorMessageNoDepositFoundTelegramBot(
        'chat123',
        'UTR123',
        'test-token',
        456
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        '⛔ No deposit with UTR UTR123 found. Please check  ',
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });
  });

  describe('sendSuccessMessageTelegramBot', () => {
    test('should send success message', async () => {
      const result = await sendSuccessMessageTelegramBot(
        'chat123',
        'MO123',
        'test-token',
        456
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        '💵 Order No. MO123 is confirmed! ✅',
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });
  });

  describe('sendDisputeMessageTelegramBot', () => {
    test('should send dispute message', async () => {
      const result = await sendDisputeMessageTelegramBot(
        'chat123',
        1000,
        800,
        'test-token',
        456
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('AMOUNT DISPUTED'),
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });
  });

  describe('sendDuplicateMessageTelegramBot', () => {
    test('should send duplicate message', async () => {
      const result = await sendDuplicateMessageTelegramBot(
        'chat123',
        'UTR123',
        'MO123',
        'test-token',
        456
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        '🚨 OrderId MO123 is Duplicate as UTR UTR123 is already confirmed with ',
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });
  });

  describe('sendBankMismatchMessageTelegramBot', () => {
    test('should send bank mismatch message', async () => {
      const result = await sendBankMismatchMessageTelegramBot(
        'chat123',
        'Bank1',
        'Bank2',
        'test-token',
        456
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('BANK MISMATCH'),
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });
  });

  describe('sendAlreadyConfirmedMessageTelegramBot', () => {
    test('should send already confirmed message with existing payin data', async () => {
      const existingPayinData = [{ status: 'SUCCESS', merchant_order_id: 'MO123' }];
      const result = await sendAlreadyConfirmedMessageTelegramBot(
        'chat123',
        'UTR123',
        'test-token',
        456,
        existingPayinData,
        {}
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        '✅ UTR UTR123 is already confirmed with this orderId MO123',
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });

    test('should send already confirmed message with getPayInData', async () => {
      const getPayInData = {
        merchant_order_id: 'MO123',
        user_submitted_utr: 'UTR456',
        status: 'SUCCESS',
      };
      const result = await sendAlreadyConfirmedMessageTelegramBot(
        'chat123',
        'UTR123',
        'test-token',
        456,
        [],
        getPayInData
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('is Already Confirmed with UTR: UTR456'),
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });

    test('should send already confirmed message with bank response data', async () => {
      const getPayInData = {
        merchant_order_id: 'MO123',
        status: 'SUCCESS',
        bank_response_id: 'BR123',
        company_id: 'C123',
      };
      getBankResponseDao.mockResolvedValue({ utr: 'UTR789' });

      const result = await sendAlreadyConfirmedMessageTelegramBot(
        'chat123',
        'UTR123',
        'test-token',
        456,
        [],
        getPayInData
      );

      expect(getBankResponseDao).toHaveBeenCalledWith({
        id: 'BR123',
        company_id: 'C123',
      });
      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('is Already Confirmed with UTR: UTR789'),
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });
  });

  describe('sendMerchantOrderIDStatusDuplicateTelegramMessage', () => {
    test('should send duplicate status message with existing payin data', async () => {
      const existingPayinData = [{ status: 'SUCCESS', merchant_order_id: 'MO123' }];
      const result = await sendMerchantOrderIDStatusDuplicateTelegramMessage(
        'chat123',
        {},
        'UTR123',
        'test-token',
        456,
        existingPayinData
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        '✅ UTR UTR123 is already confirmed with this orderId MO123',
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });

    test('should send duplicate status message with getPayInData', async () => {
      const getPayInData = {
        merchant_order_id: 'MO123',
        user_submitted_utr: 'UTR456',
        status: 'SUCCESS',
      };
      const result = await sendMerchantOrderIDStatusDuplicateTelegramMessage(
        'chat123',
        getPayInData,
        'UTR123',
        'test-token',
        456,
        []
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('is Already Confirmed with UTR: UTR456'),
        456,
        'test-token'
      );
      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });
  });

  describe('sendBankNotAssignedAlertTelegram', () => {
    test('should send bank not assigned alert', async () => {
      await sendBankNotAssignedAlertTelegram('chat123', 'CODE123', 'test-token');

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        '<b>⛔ Bank not Assigned with :</b> CODE123',
        null,
        'test-token'
      );
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });

    test('should handle errors in sending bank not assigned alert', async () => {
      telegramSenderMock.mockRejectedValueOnce(new Error('Network error'));

      await sendBankNotAssignedAlertTelegram('chat123', 'CODE123', 'test-token');

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        '<b>⛔ Bank not Assigned with :</b> CODE123',
        null,
        'test-token'
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Error sending bank not assigned alert to Telegram:',
        'Network error'
      );
    });
  });

  describe('sendTelegramDisputeMessage', () => {
    test('should send dispute message with old and current data', async () => {
      const oldData = {
        status: 'DISPUTE',
        amount: 1000,
        upi_short_code: 'UPI123',
        merchant_order_id: 'MO123',
        id: 'ID123',
        merchant_id: 'M1',
        user: 'USER1',
      };
      const currentData = {
        status: 'SUCCESS',
        amount: 800,
        upi_short_code: 'UPI456',
        merchant_order_id: 'MO456',
        id: 'ID456',
        merchant_id: 'M2',
        user: 'USER2',
      };

      await sendTelegramDisputeMessage(
        'chat123',
        oldData,
        currentData,
        null,
        'Bank1',
        'UTR123',
        'test-token'
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('Dispute Entry'),
        null,
        'test-token'
      );
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });

    test('should send dispute message with old, current, and new data', async () => {
      const oldData = {
        status: 'DISPUTE',
        amount: 1000,
        upi_short_code: 'UPI123',
        merchant_order_id: 'MO123',
        id: 'ID123',
        merchant_id: 'M1',
        user: 'USER1',
      };
      const currentData = {
        status: 'SUCCESS',
        amount: 800,
        upi_short_code: 'UPI456',
        merchant_order_id: 'MO456',
        id: 'ID456',
        merchant_id: 'M2',
        user: 'USER2',
      };
      const newData = {
        status: 'PENDING',
        amount: 900,
        upi_short_code: 'UPI789',
        merchant_order_id: 'MO789',
        id: 'ID789',
        merchant_id: 'M3',
        user: 'USER3',
      };

      await sendTelegramDisputeMessage(
        'chat123',
        oldData,
        currentData,
        newData,
        'Bank1',
        'UTR123',
        'test-token'
      );

      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('Dispute Entry'),
        null,
        'test-token'
      );
      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('Current Entry'),
        null,
        'test-token'
      );
      expect(telegramSenderMock).toHaveBeenCalledWith(
        'chat123',
        expect.stringContaining('New Entry'),
        null,
        'test-token'
      );
      expect(logger.log).toHaveBeenCalledWith('Sent!');
    });
  });
});