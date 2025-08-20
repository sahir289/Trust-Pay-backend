const { getTotalCountService } = require('./commonService.js');
const { getTotalCountDao } = require('./commonDao.js');
const { getMerchantByUserIdDao } = require('../merchants/merchantDao.js');
const { getBankaccountDao } = require('../bankAccounts/bankaccountDao.js');
const { getUserHierarchysDao } = require('../userHierarchy/userHierarchyDao.js');
const { getVendorsDao } = require('../vendors/vendorDao.js');
const { getRoleDao } = require('../roles/rolesDao.js');
const { getBankResponseByUTR } = require('../bankResponse/bankResponseDao.js');
const { getUserByCompanyCreatedAtDao } = require('../users/userDao.js');
const { logger } = require('../../utils/logger.js');

jest.mock('./commonDao.js');
jest.mock('../merchants/merchantDao.js');
jest.mock('../bankAccounts/bankaccountDao.js');
jest.mock('../userHierarchy/userHierarchyDao.js');
jest.mock('../vendors/vendorDao.js');
jest.mock('../roles/rolesDao.js');
jest.mock('../bankResponse/bankResponseDao.js');
jest.mock('../users/userDao.js');
jest.mock('../../utils/logger.js');

describe('getTotalCountService', () => {
  let userInfo;

  beforeEach(() => {
    userInfo = {
      userRole: 'ADMIN',
      designation: 'manager',
      user_id: '123',
    };
    getTotalCountDao.mockResolvedValue(100);
    getRoleDao.mockResolvedValue([{ id: 'role1' }]);
    getUserHierarchysDao.mockResolvedValue([{ config: { parent: 'parent1', siblings: { sub_merchants: [] }, child: { operations: [] } } }]);
    getMerchantByUserIdDao.mockResolvedValue([{ id: 'merchant1' }]);
    getBankaccountDao.mockResolvedValue([{ id: 'bank1' }]);
    getVendorsDao.mockResolvedValue([{ id: 'vendor1' }]);
    getBankResponseByUTR.mockResolvedValue([{ id: 'bankResponse1' }]);
    getUserByCompanyCreatedAtDao.mockResolvedValue({ id: 'admin1' });
    logger.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return count for non-merchant/vendor role without filters', async () => {
    const filters = { company_id: '456' };
    const result = await getTotalCountService('User', 'ADMIN', filters, userInfo);

    expect(getTotalCountDao).toHaveBeenCalledWith(
      'User',
      'ADMIN',
      { company_id: '456' },
      'ADMIN',
      false,
      false
    );
    expect(result).toBe(100);
  });

  test('should handle beneficiary_role filter correctly', async () => {
    const filters = { company_id: '456', beneficiary_role: 'VENDOR' };
    getRoleDao.mockImplementation(async ({ role }) => {
      if (role === 'VENDOR') return [{ id: 'vendorRole' }];
      if (role === 'ADMIN') return [{ id: 'adminRole' }];
    });

    await getTotalCountService('User', 'ADMIN', filters, userInfo);

    expect(getRoleDao).toHaveBeenCalledWith({ role: 'VENDOR' });
    expect(getRoleDao).toHaveBeenCalledWith({ role: 'ADMIN' });
    expect(getTotalCountDao).toHaveBeenCalledWith(
      'User',
      'ADMIN',
      { role_id: ['vendorRole', 'adminRole'] },
      'ADMIN',
      false,
      false
    );
  });

  test('should handle CHARGE_BACK with bank_name filter', async () => {
    const filters = { company_id: '456', bank_name: 'HDFC' };
    await getTotalCountService('ChargeBack', 'ADMIN', filters, userInfo);

    expect(getBankaccountDao).toHaveBeenCalledWith(
      { nick_name: 'HDFC' },
      1,
      10,
      'ADMIN',
      'manager'
    );
    expect(getTotalCountDao).toHaveBeenCalledWith(
      'ChargeBack',
      'ADMIN',
      { company_id: '456', bank_acc_id: ['bank1'] },
      'ADMIN',
      false,
      false
    );
  });

  test('should handle CHARGE_BACK with utr filter', async () => {
    const filters = { company_id: '456', utr: 'UTR123' };
    await getTotalCountService('ChargeBack', 'ADMIN', filters, userInfo);

    expect(getBankResponseByUTR).toHaveBeenCalledWith('UTR123');
    expect(getTotalCountDao).toHaveBeenCalledWith(
      'ChargeBack',
      'ADMIN',
      { company_id: '456', bank_acc_id: ['bankResponse1'] },
      'ADMIN',
      false,
      false
    );
  });

  test('should handle USER table for merchant role with operations designation', async () => {
    userInfo.userRole = 'MERCHANT';
    userInfo.designation = 'MERCHANT_OPERATIONS';
    const filters = { company_id: '456' };
    getUserHierarchysDao.mockImplementation(async ({ user_id }) => {
      if (user_id === '123') return [{ config: { parent: 'parent1', siblings: { sub_merchants: ['sub1'] }, child: { operations: ['op1'] } } }];
      if (user_id === 'parent1') return [{ config: { siblings: { sub_merchants: ['sub2'] }, child: { operations: ['op2'] } } }];
    });

    await getTotalCountService('User', 'MERCHANT', filters, userInfo);

    expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id: '123' });
    expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id: 'parent1' });
    expect(getTotalCountDao).toHaveBeenCalledWith(
      'User',
      'MERCHANT',
      { company_id: '456', id: ['123', 'parent1', 'sub1', 'op1', 'sub2', 'op2'] },
      false,
      false
    );
  });

  test('should handle PAYIN table for merchant role', async () => {
    userInfo.userRole = 'MERCHANT';
    userInfo.designation = 'MERCHANT';
    const filters = { company_id: '456' };
    getUserHierarchysDao.mockResolvedValue([{ config: { siblings: { sub_merchants: ['sub1'] } } }]);

    await getTotalCountService('Payin', 'MERCHANT', filters, userInfo);

    expect(getMerchantByUserIdDao).toHaveBeenCalledWith(['123', 'sub1']);
    expect(getTotalCountDao).toHaveBeenCalledWith(
      'Payin',
      'MERCHANT',
      { company_id: '456', merchant_id: ['123', 'merchant1'] },
      false,
      false
    );
  });

  test('should handle PAYOUT table for vendor role with operations', async () => {
    userInfo.userRole = 'VENDOR';
    userInfo.designation = 'VENDOR_OPERATIONS';
    const filters = { company_id: '456' };
    getUserHierarchysDao.mockResolvedValue([{ config: { parent: 'parent1' } }]);

    await getTotalCountService('Payout', 'VENDOR', filters, userInfo);

    expect(getVendorsDao).toHaveBeenCalledWith({"user_id": ["parent1"]});
    expect(getTotalCountDao).toHaveBeenCalledWith(
      'Payout',
      'VENDOR',
      { company_id: '456', vendor_id: 'vendor1' },
      false,
      false
    );
  });

  test('should handle BENEFICIARY_ACCOUNTS for vendor role', async () => {
    userInfo.userRole = 'VENDOR';
    const filters = { company_id: '456' };

    await getTotalCountService('BeneficiaryAccounts', 'VENDOR', filters, userInfo);

    expect(getUserByCompanyCreatedAtDao).toHaveBeenCalledWith('456', 'ADMIN');
    expect(getTotalCountDao).toHaveBeenCalledWith(
      'BeneficiaryAccounts',
      'VENDOR',
      { company_id: '456', user_id: ['123', 'admin1'], 'config->>is_enabled': 'true' },
      false,
      false
    );
  });

  test('should throw error for invalid tablename', async () => {
    const filters = { company_id: '456' };
    getTotalCountDao.mockRejectedValue(new Error('Invalid table name'));

    await expect(getTotalCountService('INVALID_TABLE', 'ADMIN', filters, userInfo))
      .rejects.toThrow('Invalid table name');
    expect(logger.error).toHaveBeenCalled();
  });

  test('should handle empty hierarchy data', async () => {
    userInfo.userRole = 'MERCHANT';
    getUserHierarchysDao.mockResolvedValue([]);

    await getTotalCountService('User', 'MERCHANT', { company_id: '456' }, userInfo);

    expect(getTotalCountDao).toHaveBeenCalledWith(
      'User',
      'MERCHANT',
      { company_id: '456', id: '123' },
      false,
      false
    );
  });

  test('should handle DAO errors gracefully', async () => {
    getUserHierarchysDao.mockRejectedValue(new Error('Database error'));
  
    const result = await getTotalCountService('User', 'MERCHANT', { company_id: '456' }, userInfo);
  
    // expect(logger.error).toHaveBeenCalledWith(
    //   expect.stringContaining('Error in getTotalCountService for table user:'),
    //   expect.any(Error)
    // );
    expect(result).toBe(100); 
    expect(getTotalCountDao).toHaveBeenCalledWith(
      'User',
      'MERCHANT',
      { company_id: '456'}, 
      "ADMIN",
      false,
      false,
    );
  });
});