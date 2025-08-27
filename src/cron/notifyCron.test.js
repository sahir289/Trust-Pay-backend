import collectPayinData from './notifyCron.js';
import { getPayInUrlsDao, updatePayInUrlDao } from '../apis/payIn/payInDao.js';
import { merchantPayinCallback } from '../callBacksAndWebHook/merchantCallBacks.js';
import { logger } from '../utils/logger.js';
import moment from 'moment-timezone';
import { calculateDuration } from '../helpers/index.js';

jest.mock('../apis/payIn/payInDao.js');
jest.mock('../callBacksAndWebHook/merchantCallBacks.js');
jest.mock('../utils/logger.js');
jest.mock('../helpers/index.js');

describe('collectPayinData', () => {
  const timezone = 'Asia/Kolkata';
  const now = moment().tz(timezone);

  beforeEach(() => {
    jest.clearAllMocks();
    calculateDuration.mockImplementation(() => 10);
    updatePayInUrlDao.mockResolvedValue();
    merchantPayinCallback.mockResolvedValue();
  });

  it('should fail INITIATED payins older than 10 minutes', async () => {
    const expiredPayin = {
      id: 1,
      created_at: now.clone().subtract(11, 'minutes').toISOString(),
      config: { page_reload: false },
    };

    getPayInUrlsDao
      // DROPPED/FAILED check
      .mockImplementationOnce(({ status, is_notified }) => {
        if (Array.isArray(status) && status.includes('FAILED') && status.includes('DROPPED') && is_notified === 'false') {
          return [];
        }
        throw new Error('Unexpected status for DROPPED/FAILED');
      })
      // INITIATED check
      .mockImplementationOnce(({ status }) => {
        if (status === 'INITIATED') return [expiredPayin];
        throw new Error('Unexpected status for INITIATED');
      })
      // ASSIGNED check
      .mockImplementationOnce(({ status }) => {
        if (status === 'ASSIGNED') return [];
        throw new Error('Unexpected status for ASSIGNED');
      });

    await collectPayinData(timezone);

    expect(getPayInUrlsDao).toHaveBeenCalledWith({ status: 'INITIATED' });
    expect(calculateDuration).toHaveBeenCalledWith(expiredPayin.created_at);
    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      expiredPayin.id,
      expect.objectContaining({
        status: 'FAILED',
        is_url_expires: true,
        duration: 10,
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      `INITIATED PayIn ${expiredPayin.id} FAILED due to timeout`
    );
  });

  it('should fail INITIATED payins if page_reload is true', async () => {
    const payin = {
      id: 2,
      created_at: now.clone().subtract(1, 'minutes').toISOString(),
      config: { page_reload: true },
    };

    getPayInUrlsDao
      .mockImplementationOnce(({ status, is_notified }) => {
        if (Array.isArray(status) && status.includes('FAILED') && status.includes('DROPPED') && is_notified === 'false') {
          return [];
        }
        throw new Error('Unexpected status for DROPPED/FAILED');
      })
      .mockImplementationOnce(({ status }) => {
        if (status === 'INITIATED') return [payin];
        throw new Error('Unexpected status for INITIATED');
      })
      .mockImplementationOnce(({ status }) => {
        if (status === 'ASSIGNED') return [];
        throw new Error('Unexpected status for ASSIGNED');
      });

    await collectPayinData(timezone);

    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      payin.id,
      expect.objectContaining({ status: 'FAILED', is_url_expires: true, duration: 10 })
    );
    expect(logger.info).toHaveBeenCalledWith(
      `INITIATED PayIn ${payin.id} FAILED due to page_reload`
    );
  });

  it('should drop ASSIGNED payins older than 10 minutes', async () => {
    const expiredAssigned = {
      id: 3,
      created_at: now.clone().subtract(20, 'minutes').toISOString(),
      updated_at: now.clone().subtract(11, 'minutes').toISOString(),
      config: { page_reload: false },
    };

    getPayInUrlsDao
      .mockImplementationOnce(({ status, is_notified }) => {
        if (Array.isArray(status) && status.includes('FAILED') && status.includes('DROPPED') && is_notified === 'false') {
          return [];
        }
        throw new Error('Unexpected status for DROPPED/FAILED');
      })
      .mockImplementationOnce(({ status }) => {
        if (status === 'INITIATED') return [];
        throw new Error('Unexpected status for INITIATED');
      })
      .mockImplementationOnce(({ status }) => {
        if (status === 'ASSIGNED') return [expiredAssigned];
        throw new Error('Unexpected status for ASSIGNED');
      });

    await collectPayinData(timezone);

    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      expiredAssigned.id,
      expect.objectContaining({
        status: 'DROPPED',
        is_url_expires: true,
        duration: 10,
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      `ASSIGNED PayIn ${expiredAssigned.id} dropped due to timeout`
    );
  });

  it('should process notifications for dropped payins', async () => {
    const droppedPayin = {
      id: 4,
      status: 'FAILED',
      amount: 100,
      merchant_order_id: 'MO123',
      user_submitted_utr: 'UTR123',
      config: { urls: { notify: 'https://callback.url' } },
    };

    getPayInUrlsDao
      .mockImplementationOnce(({ status, is_notified }) => {
        if (Array.isArray(status) && status.includes('FAILED') && status.includes('DROPPED') && is_notified === 'false') {
          return [droppedPayin];
        }
        throw new Error('Unexpected status for DROPPED/FAILED');
      })
      .mockImplementationOnce(({ status }) => {
        if (status === 'INITIATED') return [];
        throw new Error('Unexpected status for INITIATED');
      })
      .mockImplementationOnce(({ status }) => {
        if (status === 'ASSIGNED') return [];
        throw new Error('Unexpected status for ASSIGNED');
      });

    await collectPayinData(timezone);

    expect(merchantPayinCallback).toHaveBeenCalledWith(
      'https://callback.url',
      expect.objectContaining({
        payinId: 4,
        status: 'FAILED',
      })
    );
    expect(updatePayInUrlDao).toHaveBeenCalledWith(droppedPayin.id, { is_notified: 'true' });
  });

  it('should warn if notify URL is missing', async () => {
    const droppedPayin = {
      id: 5,
      status: 'DROPPED',
      config: { urls: {} },
    };

    getPayInUrlsDao
      .mockImplementationOnce(({ status, is_notified }) => {
        if (Array.isArray(status) && status.includes('FAILED') && status.includes('DROPPED') && is_notified === 'false') {
          return [droppedPayin];
        }
        throw new Error('Unexpected status for DROPPED/FAILED');
      })
      .mockImplementationOnce(({ status }) => {
        if (status === 'INITIATED') return [];
        throw new Error('Unexpected status for INITIATED');
      })
      .mockImplementationOnce(({ status }) => {
        if (status === 'ASSIGNED') return [];
        throw new Error('Unexpected status for ASSIGNED');
      });

    await collectPayinData(timezone);

    expect(logger.warn).toHaveBeenCalledWith('Notify URL is missing for payin', { payinId: 5 });
    expect(merchantPayinCallback).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    getPayInUrlsDao.mockRejectedValueOnce(new Error('DB failure'));

    await collectPayinData(timezone);

    expect(logger.error).toHaveBeenCalledWith(
      'Error while collecting payin data:',
      expect.any(Error)
    );
  });
});
