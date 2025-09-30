import { trackVendorsNetBalance } from './trackVendorsNetBalance.js'; 
import { logger } from './logger.js';
import { getCalculationforCronDao } from '../apis/calculation/calculationDao.js';
import { getVendorsDao } from '../apis/vendors/vendorDao.js';
import { getBankaccountDao, updateBankaccountDao } from '../apis/bankAccounts/bankaccountDao.js';

jest.mock('./logger.js');
jest.mock('../apis/calculation/calculationDao.js');
jest.mock('../apis/vendors/vendorDao.js');
jest.mock('../apis/bankAccounts/bankaccountDao.js');

describe('trackVendorsNetBalance', () => {
  let conn;

  beforeEach(() => {
    conn = { release: jest.fn() };

    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    jest.clearAllMocks();
  });

  test('should return failure if no vendor is found', async () => {
    const user_id = 'user1';
    getVendorsDao.mockResolvedValue([]);

    const result = await trackVendorsNetBalance(user_id, conn);

    expect(getVendorsDao).toHaveBeenCalledWith({ user_id });
    expect(logger.warn).toHaveBeenCalledWith(`No vendor found for user_id: ${user_id}`);
    expect(result).toEqual({
      success: false,
      message: 'Vendor not found',
      user_id,
    });
  });

  test('should return failure if no calculation data is found', async () => {
    const user_id = 'user1';
    const mockVendor = [{ id: 'vendor1', code: 'VEND1', config: {} }];
    getVendorsDao.mockResolvedValue(mockVendor);
    getCalculationforCronDao.mockResolvedValue([]);

    const result = await trackVendorsNetBalance(user_id, conn);

    expect(getVendorsDao).toHaveBeenCalledWith({ user_id });
    expect(getCalculationforCronDao).toHaveBeenCalledWith(user_id);
    expect(logger.warn).toHaveBeenCalledWith(`No calculation data found for user_id: ${user_id}`);
    expect(result).toEqual({
      success: false,
      message: 'No calculation data found',
      user_id,
    });
  });

  test('should return success if no net balance limit is configured', async () => {
    const user_id = 'user1';
    const mockVendor = [{ id: 'vendor1', code: 'VEND1', config: {} }];
    const mockCalculation = [{ net_balance: '1000' }];
    getVendorsDao.mockResolvedValue(mockVendor);
    getCalculationforCronDao.mockResolvedValue(mockCalculation);

    const result = await trackVendorsNetBalance(user_id, conn);

    expect(getVendorsDao).toHaveBeenCalledWith({ user_id });
    expect(getCalculationforCronDao).toHaveBeenCalledWith(user_id);
    expect(logger.info).toHaveBeenCalledWith(`No net balance limit configured for vendor ${mockVendor[0].code}`);
    expect(result).toEqual({
      success: true,
      message: 'No net balance limit configured',
      user_id,
      vendor_code: mockVendor[0].code,
      current_balance: 1000,
      limit: 0,
    });
  });

  // Test Case 4: Net balance within limit
  test('should return success if net balance is within limit', async () => {
    const user_id = 'user1';
    const mockVendor = [{ id: 'vendor1', code: 'VEND1', config: { net_balance: '2000' } }];
    const mockCalculation = [{ net_balance: '1000' }];
    getVendorsDao.mockResolvedValue(mockVendor);
    getCalculationforCronDao.mockResolvedValue(mockCalculation);

    const result = await trackVendorsNetBalance(user_id, conn);

    expect(getVendorsDao).toHaveBeenCalledWith({ user_id });
    expect(getCalculationforCronDao).toHaveBeenCalledWith(user_id);
    expect(logger.info).toHaveBeenCalledWith(`Net balance 1000 is within limit 2000 for vendor ${mockVendor[0].code}`);
    expect(result).toEqual({
      success: true,
      message: 'Net balance is within limit',
      user_id,
      vendor_code: mockVendor[0].code,
      current_balance: 1000,
      limit: 2000,
      exceeded: false,
    });
  });

  // Test Case 5: Net balance exceeds limit, no bank accounts
  test('should return success if net balance exceeds limit but no bank accounts found', async () => {
    const user_id = 'user1';
    const mockVendor = [{ id: 'vendor1', code: 'VEND1', config: { net_balance: '500' } }];
    const mockCalculation = [{ net_balance: '1000' }];
    getVendorsDao.mockResolvedValue(mockVendor);
    getCalculationforCronDao.mockResolvedValue(mockCalculation);
    getBankaccountDao.mockResolvedValue([]);

    const result = await trackVendorsNetBalance(user_id, conn);

    expect(getVendorsDao).toHaveBeenCalledWith({ user_id });
    expect(getCalculationforCronDao).toHaveBeenCalledWith(user_id);
    expect(getBankaccountDao).toHaveBeenCalledWith({ user_id, bank_used_for: 'PayIn' });
    expect(logger.warn).toHaveBeenCalledWith(`Net balance 1000 exceeds limit 500 for vendor ${mockVendor[0].code}. Disabling bank accounts.`);
    expect(logger.info).toHaveBeenCalledWith(`No bank accounts found for vendor ${mockVendor[0].code}`);
    expect(result).toEqual({
      success: true,
      message: 'Net balance exceeded but no bank accounts found',
      user_id,
      vendor_code: mockVendor[0].code,
      current_balance: 1000,
      limit: 500,
      exceeded: true,
      banks_disabled: 0,
    });
  });

  // Test Case 6: Net balance exceeds limit, disable bank accounts
  test('should disable bank accounts if net balance exceeds limit', async () => {
    const user_id = 'user1';
    const mockVendor = [{ id: 'vendor1', code: 'VEND1', config: { net_balance: '500' } }];
    const mockCalculation = [{ net_balance: '1000' }];
    const mockBankAccounts = [
      { id: 'bank1', nick_name: 'Bank1', is_enabled: true, company_id: 'company1', config: {} },
      { id: 'bank2', nick_name: 'Bank2', is_enabled: false, company_id: 'company1', config: {} },
    ];
    getVendorsDao.mockResolvedValue(mockVendor);
    getCalculationforCronDao.mockResolvedValue(mockCalculation);
    getBankaccountDao.mockResolvedValue(mockBankAccounts);
    updateBankaccountDao.mockResolvedValue();

    const result = await trackVendorsNetBalance(user_id, conn);

    expect(getVendorsDao).toHaveBeenCalledWith({ user_id });
    expect(getCalculationforCronDao).toHaveBeenCalledWith(user_id);
    expect(getBankaccountDao).toHaveBeenCalledWith({ user_id, bank_used_for: 'PayIn' });
    expect(updateBankaccountDao).toHaveBeenCalledWith(
      { id: 'bank1', company_id: 'company1' },
      {
        is_enabled: false,
        updated_by: user_id,
        config: expect.objectContaining({
          disabled_reason: 'Net balance exceeded limit',
          previous_net_balance: 1000,
          net_balance_limit: 500,
        }),
      },
      conn,
    );
    expect(logger.info).toHaveBeenCalledWith(`Successfully disabled bank account Bank1 for vendor ${mockVendor[0].code}`);
    expect(logger.info).toHaveBeenCalledWith(`Bank account Bank2 is already disabled`);
    expect(result).toEqual({
      success: true,
      message: 'Net balance tracking completed',
      user_id,
      vendor_code: mockVendor[0].code,
      current_balance: 1000,
      limit: 500,
      exceeded: true,
      total_banks: 2,
      banks_disabled: 1,
      disabled_banks: [{ bank_id: 'bank1', nick_name: 'Bank1' }],
      skipped_banks: [{ bank_id: 'bank2', nick_name: 'Bank2', reason: 'already_disabled' }],
    });
  });

  // Test Case 7: Vendor config parsing failure
  test('should handle vendor config parsing failure', async () => {
    const user_id = 'user1';
    const mockVendor = [{ id: 'vendor1', code: 'VEND1', config: 'invalid_json' }];
    const mockCalculation = [{ net_balance: '1000' }];
    getVendorsDao.mockResolvedValue(mockVendor);
    getCalculationforCronDao.mockResolvedValue(mockCalculation);

    const result = await trackVendorsNetBalance(user_id, conn);

    expect(logger.warn).toHaveBeenCalledWith(`Failed to parse vendor config for user_id ${user_id}:`, expect.any(Error));
    expect(result).toEqual({
      success: true,
      message: 'No net balance limit configured',
      user_id,
      vendor_code: mockVendor[0].code,
      current_balance: 1000,
      limit: 0,
    });
  });

  // Test Case 8: Lock conflict when disabling bank account
  test('should handle lock conflict when disabling bank account', async () => {
    const user_id = 'user1';
    const mockVendor = [{ id: 'vendor1', code: 'VEND1', config: { net_balance: '500' } }];
    const mockCalculation = [{ net_balance: '1000' }];
    const mockBankAccounts = [
      { id: 'bank1', nick_name: 'Bank1', is_enabled: true, company_id: 'company1', config: {} },
    ];
    getVendorsDao.mockResolvedValue(mockVendor);
    getCalculationforCronDao.mockResolvedValue(mockCalculation);
    getBankaccountDao.mockResolvedValue(mockBankAccounts);
    updateBankaccountDao.mockRejectedValue({ code: '55P03', message: 'could not obtain lock' });

    const result = await trackVendorsNetBalance(user_id, conn);

    expect(updateBankaccountDao).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(`Bank Bank1 locked by another transaction, skipping`);
    expect(result).toEqual({
      success: true,
      message: 'Net balance tracking completed',
      user_id,
      vendor_code: mockVendor[0].code,
      current_balance: 1000,
      limit: 500,
      exceeded: true,
      total_banks: 1,
      banks_disabled: 0,
      disabled_banks: [],
      skipped_banks: [{ bank_id: 'bank1', nick_name: 'Bank1', reason: 'locked' }],
    });
  });

  // Test Case 9: General error when disabling bank account
  test('should handle general error when disabling bank account', async () => {
    const user_id = 'user1';
    const mockVendor = [{ id: 'vendor1', code: 'VEND1', config: { net_balance: '500' } }];
    const mockCalculation = [{ net_balance: '1000' }];
    const mockBankAccounts = [
      { id: 'bank1', nick_name: 'Bank1', is_enabled: true, company_id: 'company1', config: {} },
    ];
    getVendorsDao.mockResolvedValue(mockVendor);
    getCalculationforCronDao.mockResolvedValue(mockCalculation);
    getBankaccountDao.mockResolvedValue(mockBankAccounts);
    updateBankaccountDao.mockRejectedValue(new Error('Database error'));

    const result = await trackVendorsNetBalance(user_id, conn);

    expect(updateBankaccountDao).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(`Failed to disable bank account Bank1:`, expect.any(Error));
    expect(result).toEqual({
      success: true,
      message: 'Net balance tracking completed',
      user_id,
      vendor_code: mockVendor[0].code,
      current_balance: 1000,
      limit: 500,
      exceeded: true,
      total_banks: 1,
      banks_disabled: 0,
      disabled_banks: [],
      skipped_banks: [{ bank_id: 'bank1', nick_name: 'Bank1', reason: 'error', error: 'Database error' }],
    });
  });

  // Test Case 10: Using provided calculation data
  test('should use provided calculation data', async () => {
    const user_id = 'user1';
    const mockVendor = [{ id: 'vendor1', code: 'VEND1', config: { net_balance: '2000' } }];
    const mockCalculation = { id: 'calc1', net_balance: '1000' };
    getVendorsDao.mockResolvedValue(mockVendor);

    const result = await trackVendorsNetBalance(user_id, conn, mockCalculation);

    expect(getCalculationforCronDao).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'Net balance is within limit',
      user_id,
      vendor_code: mockVendor[0].code,
      current_balance: 1000,
      limit: 2000,
      exceeded: false,
    });
  });
});





