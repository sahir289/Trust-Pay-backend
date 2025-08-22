import * as merchantController from './merchantController.js';

describe('merchantController index', () => {
  it('should export all controller functions', () => {
    expect(typeof merchantController.createMerchant).toBe('function');
    expect(typeof merchantController.deleteMerchant).toBe('function');
    expect(typeof merchantController.getMerchants).toBe('function');
    expect(typeof merchantController.updateMerchant).toBe('function');
    expect(typeof merchantController.getMerchantsById).toBe('function');
    expect(typeof merchantController.getMerchantCodes).toBe('function');
    expect(typeof merchantController.getMerchantsBySearch).toBe('function');
    expect(typeof merchantController.getMerchantByCode).toBe('function');
  });
});
