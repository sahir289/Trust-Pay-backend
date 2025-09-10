import { parseJSON, stringifyJSON, expirePayInIfNeeded } from './index.js';
import { getPayInForExpireDao, updatePayInUrlDao } from '../apis/payIn/payInDao.js';
import { logger } from './logger.js';
import { Status } from '../constants/index.js';
import { BadRequestError } from './appErrors.js';

jest.mock('../apis/payIn/payInDao.js');
jest.mock('./logger.js', () => ({
  logger: {
    error: jest.fn(),
    log: jest.fn(),
  },
}));

jest.useFakeTimers();

describe('Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseJSON', () => {
    it('should parse valid JSON string', () => {
      const data = '{"key": "value"}';
      expect(parseJSON(data)).toEqual({ key: 'value' });
    });

    it('should return empty object and log error for invalid JSON', () => {
      const invalidData = '{key: value}';
      const result = parseJSON(invalidData);
      expect(result).toEqual({});
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('stringifyJSON', () => {
    it('should stringify an object safely', () => {
      const obj = { key: 'value' };
      const result = stringifyJSON(obj);
      expect(result).toBe(JSON.stringify(obj));
    });

    it('should return "{}" and log error on circular object', () => {
      const circularObj = {};
      circularObj.self = circularObj;
      const result = stringifyJSON(circularObj);
      expect(result).toBe('{}');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('expirePayInIfNeeded', () => {
    const payInId = 123;

    it('should schedule a payin task and expire it after timeout', async () => {
      const payIn = { id: payInId, status: Status.INITIATED };
      getPayInForExpireDao.mockResolvedValue(payIn);
      updatePayInUrlDao.mockResolvedValue(true);

      await expirePayInIfNeeded(payInId);

      // Task should be in scheduledJobs (internal, can't directly access, but timers will simulate)
      jest.advanceTimersByTime(10 * 60 * 1000); // fast-forward 10 minutes

      // Allow promises in setTimeout to resolve
      await Promise.resolve();

      expect(getPayInForExpireDao).toHaveBeenCalledWith({ id: payInId });
      expect(updatePayInUrlDao).toHaveBeenCalledWith(payInId, { status: Status.DROPPED });
    });

    it('should not schedule the same payin twice', async () => {
      const payIn = { id: payInId, status: Status.INITIATED };
      getPayInForExpireDao.mockResolvedValue(payIn);
      updatePayInUrlDao.mockResolvedValue(true);

      await expirePayInIfNeeded(payInId);
      await expirePayInIfNeeded(payInId);

      expect(logger.error).toHaveBeenCalledWith(`PayIn ${payInId} task is already scheduled.`);
    });

    it('should log and not update if status is not INITIATED or ASSIGNED', async () => {
      const payIn = { id: payInId, status: Status.DROPPED };
      getPayInForExpireDao.mockResolvedValue(payIn);

      await expirePayInIfNeeded(payInId);
      jest.advanceTimersByTime(10 * 60 * 1000);
      await Promise.resolve();

      expect(logger.log).toHaveBeenCalledWith('Status is not initiated or assigned', Status.DROPPED);
      expect(updatePayInUrlDao).not.toHaveBeenCalled();
    });

    it('should log error if payin not found', async () => {
      getPayInForExpireDao.mockResolvedValue(null);

      await expirePayInIfNeeded(payInId);
      jest.advanceTimersByTime(10 * 60 * 1000);
      await Promise.resolve();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error executing PayIn ${payInId} task:`),
        expect.any(BadRequestError),
      );
    });
  });
});
