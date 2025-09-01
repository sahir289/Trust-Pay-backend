import collectPayinData from './notifyCron.js';
import { getPayInsForCronDao, updatePayInUrlDao } from '../apis/payIn/payInDao.js';
import { merchantPayinCallback } from '../callBacksAndWebHook/merchantCallBacks.js';
import { logger } from '../utils/logger.js';
import moment from 'moment-timezone';
import { calculateDuration } from '../helpers/index.js';

jest.mock('../apis/payIn/payInDao.js');
jest.mock('../callBacksAndWebHook/merchantCallBacks.js');
jest.mock('../utils/logger.js');
jest.mock('../helpers/index.js');
jest.mock('moment-timezone', () => {
  const actualMoment = jest.requireActual('moment-timezone');
  const momentMock = (date) => {
    const momentInstance = actualMoment(date);
    momentInstance.tz = (timezone) => {
      const tzMoment = actualMoment.tz(date, timezone);
      tzMoment.clone = () => momentMock(tzMoment);
      tzMoment.subtract = (amount, unit) => {
        const newMoment = actualMoment(tzMoment).subtract(amount, unit);
        return momentMock(newMoment);
      };
      return tzMoment;
    };
    return momentInstance;
  };
  momentMock.tz = (date, timezone) => {
    const tzMoment = actualMoment.tz(date, timezone);
    tzMoment.clone = () => momentMock(tzMoment);
    tzMoment.subtract = (amount, unit) => {
      const newMoment = actualMoment(tzMoment).subtract(amount, unit);
      return momentMock(newMoment);
    };
    return tzMoment;
  };
  return momentMock;
});

describe('collectPayinData', () => {
  const timezone = 'Asia/Kolkata';
  let now;

  beforeEach(() => {
    jest.clearAllMocks();
    now = moment('2025-08-27T13:00:00.000Z').tz(timezone);
    calculateDuration.mockImplementation(() => 10);
    updatePayInUrlDao.mockResolvedValue();
    merchantPayinCallback.mockResolvedValue();
    getPayInsForCronDao
      .mockResolvedValueOnce([]) 
      .mockResolvedValueOnce([]) 
      .mockResolvedValueOnce([]); 
  });

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2025-08-27T13:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('should fail INITIATED payins older than 10 minutes', async () => {
    const expiredPayin = {
      id: 1,
      created_at: now.clone().subtract(11, 'minutes').toISOString(),
      config: { page_reload: false },
    };

    getPayInsForCronDao
      .mockReset()
      .mockResolvedValueOnce([]) 
      .mockResolvedValueOnce([expiredPayin]) 
      .mockResolvedValueOnce([]); 

    await collectPayinData('Asia/Kolkata');

    expect(getPayInsForCronDao).toHaveBeenCalledWith({ status: ['FAILED', 'DROPPED'], is_notified: 'false' });
    expect(getPayInsForCronDao).toHaveBeenCalledWith({ status: 'INITIATED' });
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

    getPayInsForCronDao
      .mockReset()
      .mockResolvedValueOnce([]) 
      .mockResolvedValueOnce([payin]) 
      .mockResolvedValueOnce([]); 

    await collectPayinData(timezone);

    expect(getPayInsForCronDao).toHaveBeenCalledWith({ status: ['FAILED', 'DROPPED'], is_notified: 'false' });
    expect(getPayInsForCronDao).toHaveBeenCalledWith({ status: 'INITIATED' });
    expect(calculateDuration).toHaveBeenCalledWith(payin.created_at);
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
      created_at: now.clone().subtract(11, 'minutes').toISOString(),
      updated_at: now.clone().subtract(11, 'minutes').toISOString(),
      config: { page_reload: false },
    };

    getPayInsForCronDao
      .mockReset()
      .mockResolvedValueOnce([]) 
      .mockResolvedValueOnce([]) 
      .mockResolvedValueOnce([expiredAssigned]); 
    calculateDuration.mockReturnValue(11); 

    await collectPayinData(timezone);

    expect(getPayInsForCronDao).toHaveBeenCalledWith({ status: ['FAILED', 'DROPPED'], is_notified: 'false' });
    expect(getPayInsForCronDao).toHaveBeenCalledWith({ status: 'ASSIGNED' });
    expect(calculateDuration).toHaveBeenCalledWith(expiredAssigned.created_at);
    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      expiredAssigned.id,
      expect.objectContaining({
        status: 'DROPPED',
        is_url_expires: true,
        duration: 11,
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

    getPayInsForCronDao
      .mockReset()
      .mockResolvedValueOnce([droppedPayin]) 
      .mockResolvedValueOnce([]) 
      .mockResolvedValueOnce([]); 

    await collectPayinData(timezone);

    expect(getPayInsForCronDao).toHaveBeenCalledWith({ status: ['FAILED', 'DROPPED'], is_notified: 'false' });
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

    getPayInsForCronDao
      .mockReset()
      .mockResolvedValueOnce([droppedPayin]) 
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]); 

    await collectPayinData(timezone);

    expect(getPayInsForCronDao).toHaveBeenCalledWith({ status: ['FAILED', 'DROPPED'], is_notified: 'false' });
    expect(logger.warn).toHaveBeenCalledWith('Notify URL is missing for payin', { payinId: 5 });
    expect(merchantPayinCallback).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    getPayInsForCronDao
      .mockReset()
      .mockRejectedValueOnce(new Error('DB failure')); 

    await collectPayinData(timezone);

    expect(logger.error).toHaveBeenCalledWith(
      'Error while collecting payin data:',
      expect.any(Error)
    );
  });
});