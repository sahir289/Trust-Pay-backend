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
