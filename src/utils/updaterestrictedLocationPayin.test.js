import { processPayInRestricted } from './updateRestrictedLocationPayin.js'; 
import { updatePayInUrlDao } from '../apis/payIn/payInDao.js';
import { merchantPayinCallback } from '../callBacksAndWebHook/merchantCallBacks.js';
import { logger } from './logger.js';
import { Status } from '../constants/index.js';

jest.mock('../apis/payIn/payInDao.js', () => ({
  updatePayInUrlDao: jest.fn(),
}));

jest.mock('../callBacksAndWebHook/merchantCallBacks.js', () => ({
  merchantPayinCallback: jest.fn(),
}));

jest.mock('./logger.js', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../helpers/index.js', () => ({
  calculateDuration: jest.fn(() => 12345),
}));

describe('processPayInRestricted', () => {
  const basePayIn = {
    id: 'payin123',
    status: Status.INITIATED,
    config: {
      urls: {
        return: 'http://return.url',
        notify: 'http://notify.url',
      },
    },
    merchant_order_id: 'order123',
    amount: 1000,
    user_submitted_utr: 'UTR123',
    created_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should process payin with valid status and call updatePayInUrlDao and callback', async () => {
    const result = await processPayInRestricted({ ...basePayIn }, 'limit_reached');

    expect(updatePayInUrlDao).toHaveBeenCalledWith(basePayIn.id, expect.objectContaining({
      status: Status.FAILED,
      is_url_expires: true,
      is_notified: true,
    }));
    expect(merchantPayinCallback).toHaveBeenCalledWith(
      basePayIn.config.urls.notify,
      expect.objectContaining({
        status: Status.FAILED,
        payinId: basePayIn.id,
        merchantOrderId: basePayIn.merchant_order_id,
      })
    );
    expect(result).toBe(basePayIn.config.urls.return);
  });

  test('should log warning if payin status is invalid', async () => {
    const invalidPayIn = { ...basePayIn, status: Status.FAILED };
    const result = await processPayInRestricted(invalidPayIn, 'some_reason');

    expect(logger.warn).toHaveBeenCalledWith(
      `Pay-in URL with ID ${invalidPayIn.id} has invalid status: ${invalidPayIn.status}`
    );
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(merchantPayinCallback).not.toHaveBeenCalled();
    expect(result).toBe(invalidPayIn.config.urls.return);
  });

  test('should handle errors and return error message', async () => {
    updatePayInUrlDao.mockImplementationOnce(() => {
      throw new Error('DB error');
    });

    const result = await processPayInRestricted({ ...basePayIn }, 'limit');

    expect(logger.error).toHaveBeenCalledWith(
      'Error processing pay-in URL:',
      expect.any(Error)
    );
    expect(result).toBe('DB error');
  });

  test('should not await merchantPayinCallback', async () => {
    await processPayInRestricted({ ...basePayIn }, 'reason');
    // ensure the callback was called asynchronously (we cannot await inside the function)
    expect(merchantPayinCallback).toHaveBeenCalled();
  });
});
