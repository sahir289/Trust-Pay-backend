// __tests__/telegramSender.test.js
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
    log: jest.fn(), 
    warn: jest.fn(),
    debug: jest.fn(),
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
    expect(logger.log).toHaveBeenCalledWith(
      'Message sent successfully to chat 12345.',
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
    expect(logger.log).toHaveBeenCalledWith(
      'Message sent successfully to chat 12345.',
    );
    expect(result).toBe(true);
  });

  it('should log error and return false if axios.post fails', async () => {
    axios.post.mockRejectedValueOnce({
      data: { description: 'Too Many Requests' },
    });

    const result = await telegramSender('12345', 'Hello');

    expect(logger.error).toHaveBeenCalledWith(
      'Error sending message to Telegram:',
      'Too Many Requests',
    );
    expect(result).toBe(false);
  });

  it('should fallback error message when error.data.description is missing', async () => {
    axios.post.mockRejectedValueOnce(new Error('Network error'));

    const result = await telegramSender('12345', 'Hello');

    expect(logger.error).toHaveBeenCalledWith(
      'Error sending message to Telegram:',
      'Request failed with status code 429',
    );
    expect(result).toBe(false);
  });
});
