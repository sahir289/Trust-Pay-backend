// merchantNotification.test.js
import axios from 'axios';
import { logger } from '../utils/logger.js';
// import { BadRequestError } from '../utils/appErrors.js';
import {
  merchantPayinCallback,
  merchantPayoutCallback,
} from './merchantCallBacks.js'; 

jest.mock('axios');

jest.mock('../utils/logger.js', () => ({
    logger: {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
    },
  }));

describe('sendMerchantNotification', () => {
  const mockUrl = 'http://merchant.com/callback';
  const mockData = { id: 123, status: 'SUCCESS' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

//   it('should throw BadRequestError if URL is missing', async () => {
//     await expect(merchantPayinCallback('', mockData)).rejects.toThrow(
//       BadRequestError
//     );

//     expect(logger.error).toHaveBeenCalledWith(
//       'No URL provided for Payin Notification'
//     );
//   });

  it('should send notification successfully', async () => {
    const mockResponse = { status: 200, data: { success: true } };
    axios.post.mockResolvedValueOnce(mockResponse);

    const result = await merchantPayinCallback(mockUrl, mockData);

    expect(axios.post).toHaveBeenCalledWith(mockUrl, mockData);
    expect(logger.info).toHaveBeenCalledWith('Sending Payin Notification to Merchant', {
      notify_url: mockUrl,
      notify_data: mockData,
    });
    expect(logger.info).toHaveBeenCalledWith('Payin Notification Sent Successfully', {
      status: 200,
      url: mockUrl,
      data: mockData,
    });
    expect(result).toEqual({ success: true });
  });

  it('should handle axios error with response', async () => {
    const mockError = {
      message: 'Request failed',
      response: { status: 500, data: { error: 'server error' } },
    };
    axios.post.mockRejectedValueOnce(mockError);

    const result = await merchantPayinCallback(mockUrl, mockData);

    expect(logger.error).toHaveBeenCalledWith(
      'Error Notifying Merchant at Payin URL: Request failed',
      {
        status: 500,
        response: { error: 'server error' },
        url: mockUrl,
        data: mockData,
      }
    );
    expect(result).toEqual({
      message: 'Error Notifying Merchant at Payin URL: Request failed',
    });
  });

  it('should handle axios error without response', async () => {
    const mockError = new Error('Network error');
    axios.post.mockRejectedValueOnce(mockError);

    const result = await merchantPayinCallback(mockUrl, mockData);

    expect(logger.error).toHaveBeenCalledWith(
      'Error Notifying Merchant at Payin URL: Network error',
      {
        status: 'N/A',
        response: {},
        url: mockUrl,
        data: mockData,
      }
    );
    expect(result).toEqual({
      message: 'Error Notifying Merchant at Payin URL: Network error',
    });
  });

  it('should call merchantPayoutCallback with type Payout', async () => {
    const mockResponse = { status: 200, data: { ok: true } };
    axios.post.mockResolvedValueOnce(mockResponse);

    const result = await merchantPayoutCallback(mockUrl, mockData);

    expect(axios.post).toHaveBeenCalledWith(mockUrl, mockData);
    expect(logger.info).toHaveBeenCalledWith('Sending Payout Notification to Merchant', {
      notify_url: mockUrl,
      notify_data: mockData,
    });
    expect(result).toEqual({ ok: true });
  });
});
