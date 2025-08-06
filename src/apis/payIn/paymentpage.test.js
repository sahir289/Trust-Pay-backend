const { getPayInUrlService } = require('./payInService.js');
const { getMerchantsDao } = require('../merchants/merchantDao.js');
const { getMerchantBankDao } = require('../bankAccounts/bankaccountDao.js');
const { updatePayInUrlDao } = require('./payInDao');

const mockPayIn = {
    id: 'payin1',
    merchant_id: 'merchant1',
    merchant_order_id: '123',
    config: { urls: { return: 'http://return.url' } },
    expiration_date: 1630000001000,
    amount: 100,
    one_time_used: false,
    status: 'INITIATED',
    user: 'user1',
};
const mockMerchant = { id: 'merchant1', name: 'Test Merchant' };
const mockBanks = [{ bank_id: 'bank1', merchant_id: 'merchant1' }];

jest.mock('./payInService.js', () => ({
    getPayInUrlService: jest.fn(),
}));

jest.mock('./payInDao', () => ({
    updatePayInUrlDao: jest.fn(),
}));

jest.mock('../bankAccounts/bankaccountDao.js', () => ({
    getMerchantBankDao: jest.fn(),
}));
jest.mock('../merchants/merchantDao.js', () => ({
    getMerchantsDao: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
}));


test('should verify payin URL successfully and return result', async () => {
    getPayInUrlService.mockResolvedValueOnce(mockPayIn);
    getMerchantsDao.mockResolvedValueOnce(mockMerchant);
    getMerchantBankDao.mockResolvedValueOnce(mockBanks);
    updatePayInUrlDao.mockResolvedValueOnce({ id: 'payin1' });

    const result = await getPayInUrlService('123', null, true);

    expect(getPayInUrlService).toHaveBeenCalledWith('123', null, true);
    expect(result).toEqual(mockPayIn);
});

test('should throw BadRequestError for invalid merchant order ID', async () => {
    getPayInUrlService.mockResolvedValueOnce(null);

    await expect(verifyPayinsService('123', {}, 'false')).rejects.toThrow('Invalid merchant order id');
    expect(require('../utils/logger').error).toHaveBeenCalledWith('Error in verifyPayinsService:', expect.any(Error));
    expect(getPayInUrlService).toHaveBeenCalledWith('123', undefined);
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(getMerchantsDao).not.toHaveBeenCalled();
    expect(getMerchantBankDao).not.toHaveBeenCalled();
});