// src/helpers/telegramApi.test.js
const axios = require('axios');
const { createTelegramSender } = require('./telegramApi');
const config = require('../config/config');
const { logger } = require('../utils/logger');
const { BadRequestError } = require('../utils/appErrors');

jest.mock('axios');
// jest.mock('../utils/logger');
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()  },
}));
jest.mock('../config/config', () => ({
  telegram: {
    telegram_url: 'https://api.telegram.org/bot',
    telegramBotToken: 'mock-token',
  },
  aws: { accessKeyId: 'fake', secretAccessKey: 'fake' },
  secretKeyS3: 'fake',
  bucketRegion: 'us-east-1',
  bucketName: 'fake-bucket',
  databaseWriterUrl: 'postgres://user:pass@localhost:5432/testdb',
  databaseReaderUrl: 'postgres://user:pass@localhost:5432/testdb',
  env: 'test',
}));

describe('Telegram Sender', () => {
  let telegramSender;
  let messageQueue;
  let isProcessingQueue;

  beforeEach(() => {
    telegramSender = createTelegramSender();
    jest.clearAllMocks();

    // Reset internal queue & processing flag
    const telegramApiModule = require('./telegramApi');
    messageQueue = telegramApiModule.__getMessageQueue?.() || [];
    isProcessingQueue = telegramApiModule.__getProcessingFlag?.() || false;
    messageQueue.length = 0;
    if (typeof telegramApiModule.__setProcessingFlag === 'function') {
      telegramApiModule.__setProcessingFlag(false);
    }
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should throw BadRequestError if token is not provided', async () => {
    const invalidSender = createTelegramSender();
    await expect(
      invalidSender('chat123', 'test message', null, null)
    ).rejects.toThrow(BadRequestError);
    await expect(
      invalidSender('chat123', 'test message', null, null)
    ).rejects.toThrow('TELEGRAM_BOT_TOKEN is required either via argument or config.');
  });

  test('should send message successfully with valid parameters', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { ok: true } });

    const result = await telegramSender('chat123', 'test message', null, 'test-token');

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      {
        chat_id: 'chat123',
        text: 'test message',
        parse_mode: 'HTML',
      }
    );
    expect(result).toBe(true);
    // expect(logger.info).toHaveBeenCalled();
  });

  test('should send message with replyToMessageId when provided', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { ok: true } });

    await telegramSender('chat123', 'test message', 456, 'test-token');

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      {
        chat_id: 'chat123',
        text: 'test message',
        parse_mode: 'HTML',
        reply_to_message_id: 456,
      }
    );
  });

  test('should handle rate limit (429) and retry after specified time', async () => {
    jest.useFakeTimers();
    axios.post
      .mockRejectedValueOnce({
        response: { status: 429, data: { parameters: { retry_after: 2 } } },
      })
      .mockResolvedValueOnce({ status: 200, data: { ok: true } });

    const sendPromise = telegramSender('chat123', 'test message', null, 'test-token');

    // advance timers to trigger retry
    await Promise.resolve();
    jest.advanceTimersByTime(2000);
    await sendPromise;

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith('Rate limit hit, retrying after 2 seconds');
    // expect(logger.info).toHaveBeenCalled();
  });

  test('should reject with error for non-429 errors', async () => {
    const error = new Error('Network error');
    axios.post.mockRejectedValue(error);

    await expect(
      telegramSender('chat123', 'test message', null, 'test-token')
    ).rejects.toThrow('Network error');
    expect(logger.error).toHaveBeenCalled();
  });

  test('should process multiple messages in queue sequentially', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { ok: true } });

    const promises = [
      telegramSender('chat123', 'message1', null, 'test-token'),
      telegramSender('chat456', 'message2', null, 'test-token'),
    ];

    await Promise.all(promises);

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      {
        chat_id: 'chat123',
        text: 'message1',
        parse_mode: 'HTML',
      }
    );
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      {
        chat_id: 'chat456',
        text: 'message2',
        parse_mode: 'HTML',
      }
    );
  });
});
