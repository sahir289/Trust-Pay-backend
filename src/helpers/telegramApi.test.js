const axios = require('axios');
const { createTelegramSender } = require('./telegramApi');
const { logger } = require('../utils/logger');
const { BadRequestError } = require('../utils/appErrors');

jest.mock('axios');

/**
 * Logger mock
 */
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

/**
 * ✅ CRITICAL FIX:
 * telegramBotToken MUST be at ROOT LEVEL
 */
jest.mock('../config/config.js', () => ({
  telegramBotToken: 'mock-token',

  telegram: {
    telegram_url: 'https://api.telegram.org/bot',
  },

  aws: {
    accessKeyId: 'fake-access',
    secretAccessKey: 'fake-secret',
  },

  secretKeyS3: 'fake-secret',
  bucketRegion: 'us-east-1',
  bucketName: 'fake-bucket',

  databaseWriterUrl: 'postgres://user:pass@localhost:5432/testdb',
  databaseReaderUrl: 'postgres://user:pass@localhost:5432/testdb',

  env: 'test',
}));

jest.setTimeout(20000);

describe('Telegram Sender', () => {
  let telegramSender;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    telegramSender = createTelegramSender();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should send telegram message successfully', async () => {
    axios.post.mockResolvedValueOnce({ status: 200 });

    const promise = telegramSender(123, 'Hello World', null);

    await Promise.resolve();
    jest.runOnlyPendingTimers();

    const result = await promise;

    expect(result).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.telegram.org/botmock-token/sendMessage',
      {
        chat_id: 123,
        text: 'Hello World',
        parse_mode: 'HTML',
      },
    );
  });

  test('should throw BadRequestError when token is missing', async () => {
    const senderWithoutToken = createTelegramSender();

    await expect(
      senderWithoutToken(123, 'Hello', null, null),
    ).rejects.toThrow(BadRequestError);

    expect(axios.post).not.toHaveBeenCalled();
  });

  test('should retry message on 429 rate limit', async () => {
    axios.post
      .mockRejectedValueOnce({
        response: {
          status: 429,
          data: { parameters: { retry_after: 1 } },
        },
      })
      .mockResolvedValueOnce({ status: 200 });

    const promise = telegramSender(123, 'Rate limit test', null);

    await Promise.resolve();
    jest.advanceTimersByTime(1000); // retry_after
    jest.advanceTimersByTime(500); // RATE_LIMIT_MS

    const result = await promise;

    expect(result).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  // test('should resolve false on non-429 error', async () => {
  //   axios.post.mockRejectedValueOnce({
  //     response: {
  //       status: 400,
  //       data: { error: 'Bad request' },
  //     },
  //     message: 'Request failed',
  //   });

  //   const promise = telegramSender(123, 'Fail message', null);

  //   await Promise.resolve();
  //   jest.advanceTimersByTime(500); // RATE_LIMIT_MS
  //   jest.runOnlyPendingTimers();

  //   const result = await promise;

  //   expect(result).toBe(false);
  //   expect(logger.error).toHaveBeenCalled();
  // });

  // test('should process messages sequentially with rate limiting', async () => {
  //   axios.post.mockResolvedValue({ status: 200 });

  //   const p1 = telegramSender(1, 'Message 1', null);
  //   const p2 = telegramSender(2, 'Message 2', null);

  //   await Promise.resolve();

  //   jest.advanceTimersByTime(500);
  //   await Promise.resolve();

  //   jest.advanceTimersByTime(500);

  //   const r1 = await p1;
  //   const r2 = await p2;

  //   expect(r1).toBe(true);
  //   expect(r2).toBe(true);
  //   expect(axios.post).toHaveBeenCalledTimes(2);
  // });
});
