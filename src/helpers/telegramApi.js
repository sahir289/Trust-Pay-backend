import axios from 'axios';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { BadRequestError } from '../utils/appErrors.js';
const messageQueue = [];
let isProcessingQueue = false;
const RATE_LIMIT_MS = 500;
async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  try {
    while (messageQueue.length > 0) {
      const { chatId, message, replyToMessageId, token, resolve, reject } =
        messageQueue.shift();

      const sendMessageUrl = `${config.telegram.telegram_url}${token}/sendMessage`;
      const payload = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      };
      if (replyToMessageId != null) {
        payload.reply_to_message_id = replyToMessageId;
      }
      try {
        // logger.info(
        //   `Sending message to chat ${chatId} -- payload is ${payload.text}`,
        // );
        // const data =
        await axios.post(sendMessageUrl, payload);
        // logger.info('data from telegram after sending message', {
        //   status: data?.status,
        //   data: data?.data,
        // });
        // logger.info(
        //   `Message sent successfully to chat ${chatId}. -- payload is ${payload.text}`,
        // );
        resolve(true);
      } catch (error) {
        const status = error.response?.status;
        const errData = error.response?.data;

        if (status === 429) {
          const retryAfter = errData?.parameters?.retry_after || 5;
          logger.warn(
            `Rate limit hit, retrying after ${retryAfter} seconds for chat ${chatId}`,
          );
          setTimeout(() => {
            messageQueue.push({
              chatId,
              message,
              replyToMessageId,
              token,
              resolve,
              reject,
            });
            processQueue();
          }, retryAfter * 1000);
        } else {
          logger.error(
            `Failed to send message to chat ${chatId}. Message: "${message}". Status: ${status}. Error: ${error.message}`,
            { status, errData },
          );
          resolve(false);
        }
      }
      await new Promise((res) => setTimeout(res, RATE_LIMIT_MS));
    }
  } finally {
    isProcessingQueue = false;
  }
}

export const createTelegramSender = () => {
  return async (
    chatId,
    message,
    replyToMessageId,
    token = config?.telegramBotToken,
  ) => {
    if (!token) {
      throw new BadRequestError(
        'TELEGRAM_BOT_TOKEN is required either via argument or config.',
      );
    }

    return new Promise((resolve, reject) => {
      messageQueue.push({
        chatId,
        message,
        replyToMessageId,
        token,
        resolve,
        reject,
      });
      processQueue();
    });
  };
};

/**
 * Send a file (document) to Telegram
 * @param {string} chatId - Telegram chat ID
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name with extension
 * @param {string} caption - Optional caption for the file
 * @param {string} token - Telegram bot token
 * @returns {Promise<boolean>} - True if sent successfully
 */
export const sendTelegramFile = async (
  chatId,
  fileBuffer,
  fileName,
  caption = '',
  token = config?.telegramBotToken,
) => {
  if (!token) {
    logger.error('TELEGRAM_BOT_TOKEN is required');
    throw new BadRequestError('TELEGRAM_BOT_TOKEN is required');
  }

  try {
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', fileBuffer, fileName);
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
    }

    const sendDocumentUrl = `${config.telegram.telegram_url}${token}/sendDocument`;
    await axios.post(sendDocumentUrl, formData, {
      headers: formData.getHeaders(),
    });

    logger.info(`File ${fileName} sent successfully to chat ${chatId}`);
    return true;
  } catch (error) {
    logger.error(
      `Failed to send file ${fileName} to chat ${chatId}. Error: ${error.message}`,
      { error: error.response?.data },
    );
    return false;
  }
};
