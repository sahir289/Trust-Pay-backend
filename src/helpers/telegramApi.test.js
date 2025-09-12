import axios from 'axios';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { BadRequestError } from '../utils/appErrors.js';
import { createTelegramSender } from '../helpers/telegramApi.js';

jest.mock('axios');

jest.mock('../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock config to avoid undefined errors
jest.mock('../config/config.js', () => ({
  telegram: {
    telegram_url: 'https://api.telegram.org/bot',
    telegramBotToken: 'mock-token',
  },
}));

describe('createTelegramSender', () => {
  let telegramSender;

  beforeEach(() => {
    telegramSender = createTelegramSender();
    jest.clearAllMocks();
  });

  it('should throw BadRequestError if no token is provided', async () => {
    await expect(
      telegramSender('12345', 'Hello', null, null),
    ).rejects.toThrow(BadRequestError);
  });

  it('should send a message successfully without replyToMessageId', async () => {
    axios.post.mockResolvedValueOnce({ data: { ok: true } });

    const result = await telegramSender('12345', 'Hello');

    expect(axios.post).toHaveBeenCalledWith(
      `${config.telegram.telegram_url}${config.telegramBotToken}/sendMessage`,
      {
        chat_id: '12345',
        text: 'Hello',
        parse_mode: 'HTML',
      },
    );
    expect(result).toBe(true);
  });

  it('should send a message successfully with replyToMessageId', async () => {
    axios.post.mockResolvedValueOnce({ data: { ok: true } });

    const result = await telegramSender('12345', 'Hello', 999);

    expect(axios.post).toHaveBeenCalledWith(
      `${config.telegram.telegram_url}${config.telegramBotToken}/sendMessage`,
      {
        chat_id: '12345',
        text: 'Hello',
        parse_mode: 'HTML',
        reply_to_message_id: 999,
      },
    );
    expect(result).toBe(true);
  });

  it('should log error and return false if axios.post fails with non-429 error', async () => {
    const error = {
      response: {
        status: 400,
        data: { description: 'Bad Request' },
      },
      message: 'Request failed with status code 400',
    };
    axios.post.mockRejectedValueOnce(error);

    const result = await telegramSender('12345', 'Hello');

    expect(logger.error).toHaveBeenCalledWith(
      'Error sending message to Telegram:',
      {
        data: { description: 'Bad Request' },
        message: 'Request failed with status code 400',
        status: 400,
      },
    );
    expect(result).toBe(false);
  });

  it('should fallback error message when error.data.description is missing', async () => {
    const error = new Error('Network error');
    axios.post.mockRejectedValueOnce(error);

    const result = await telegramSender('12345', 'Hello');

    expect(logger.error).toHaveBeenCalledWith(
      'Error sending message to Telegram:',
      {
        data: undefined,
        message: 'Network error',
        status: undefined,
      },
    );
    expect(result).toBe(false);
  });

  it('should retry on 429 rate limit error', async () => {
    const error = {
      response: {
        status: 429,
        data: { parameters: { retry_after: 1 } },
      },
      message: 'Request failed with status code 429',
    };
    axios.post.mockRejectedValueOnce(error);
    axios.post.mockResolvedValueOnce({ data: { ok: true } });

    const result = await telegramSender('12345', 'Hello');

    expect(logger.error).toHaveBeenCalledWith(
      'Error sending message to Telegram:',
      {
        data: { parameters: { retry_after: 1 } },
        message: 'Request failed with status code 429',
        status: 429,
      },
    );
    expect(logger.warn).toHaveBeenCalledWith('Rate limit hit, retrying after 1 seconds');
    expect(result).toBe(true); // After retry, the message should succeed
  });
});