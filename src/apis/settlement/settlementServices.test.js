const {
  getSettlementService,
  createSettlementService,
  getSettlementServiceById,
  updateSettlementService,
  deleteSettlementService,
  getSettlementsBySearchService,
} = require('./settlementServices.js');
const {
      getSettlementDao,
  createSettlementDao,
  updateSettlementDao,
  deleteSettlementDao,
  getSettlementsBySearchDao,
} = require('./settlementDao.js');
const {
  getCalculationforCronDao,
  updateCalculationBalanceDao,
  updateCalculationConfigDao,
} = require('../calculation/calculationDao');
const { getMerchantsDao } = require('../merchants/merchantDao');
const { getUserHierarchysDao } = require('../userHierarchy/userHierarchyDao');
const {
  getBankResponseByUTR,
  updateBankResponseDao,
} = require('../bankResponse/bankResponseDao');
const { getVendorsDao } = require('../vendors/vendorDao');
const { calculateCommission } = require('../../utils/calculation');
const { checkLockEdit } = require('../../utils/advisoryLock');
const {
  getBeneficiaryAccountDao,
  updateBeneficiaryAccountDao,
} = require('../beneficiaryAccounts/beneficiaryAccountDao');
const { BadRequestError, NotFoundError, InternalServerError } = require('../../utils/appErrors');
const { Role, Status } = require('../../constants/index');

jest.mock('./settlementDao');
jest.mock('../calculation/calculationDao');
jest.mock('../merchants/merchantDao');
jest.mock('../userHierarchy/userHierarchyDao');
jest.mock('../bankResponse/bankResponseDao');
jest.mock('../vendors/vendorDao');
jest.mock('../../utils/calculation');
jest.mock('../../utils/advisoryLock');
jest.mock('../beneficiaryAccounts/beneficiaryAccountDao');

describe('Settlement Service', () => {
  const mockConn = {};
  const mockIds = { id: 1, company_id: 1, role: Role.MERCHANT, user_id: 1 };
  const mockFilters = { user_id: [1], search: 'test' };
  const mockPayload = {
    user_id: 1,
    company_id: 1,
    amount: 100,
    method: 'BANK',
    config: { debit_credit: 'RECEIVED', reference_id: 'UTR123' },
    updated_by: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getMerchantsDao.mockResolvedValue([]);
  });

  describe('getSettlementServiceById', () => {
    it('should fetch settlement by ID for MERCHANT role', async () => {
      const mockSettlement = [{ id: 1, amount: 100 }];
      getSettlementDao.mockResolvedValue(mockSettlement);

      const result = await getSettlementServiceById(mockIds);

      expect(getSettlementDao).toHaveBeenCalledWith(
        { id: mockIds.id, company_id: mockIds.company_id },
        null,
        null,
        null,
        null,
        expect.any(Array)
      );
      expect(result).toEqual(mockSettlement);
    });

    it('should fetch settlement by ID for VENDOR role', async () => {
      const mockSettlement = [{ id: 1, amount: 200 }];
      getSettlementDao.mockResolvedValue(mockSettlement);

      const result = await getSettlementServiceById({ ...mockIds, role: Role.VENDOR });

      expect(getSettlementDao).toHaveBeenCalledWith(
        { id: mockIds.id, company_id: mockIds.company_id },
        null,
        null,
        null,
        null,
        expect.any(Array)
      );
      expect(result).toEqual(mockSettlement);
    });

    it('should throw error when getSettlementDao fails', async () => {
      const error = new Error('DAO error');
      getSettlementDao.mockRejectedValue(error);

      await expect(getSettlementServiceById(mockIds)).rejects.toThrow(error);
    });
  });

  describe('getSettlementService', () => {
    it('should fetch settlements with valid parameters', async () => {
      const mockSettlementData = [{ id: 1, amount: 100 }];
      getSettlementDao.mockResolvedValue(mockSettlementData);
      getUserHierarchysDao.mockResolvedValue([]);

      const result = await getSettlementService(mockIds, mockFilters, 1, 10, 'sno', 'DESC', Role.MERCHANT, 1, 'MERCHANT');

      expect(getSettlementDao).toHaveBeenCalledWith(
        expect.objectContaining({ company_id: mockIds.company_id }),
        1,
        10,
        'sno',
        'DESC',
        expect.any(Array)
      );
      expect(result).toEqual(mockSettlementData);
    });

    it('should throw BadRequestError if company_id is missing', async () => {
      await expect(getSettlementService({}, mockFilters, 1, 10)).rejects.toThrow(BadRequestError);
    });

    it('should apply user_id filter for MERCHANT_OPERATIONS', async () => {
      getUserHierarchysDao.mockResolvedValue([{ config: { parent: 2 } }]);
      getSettlementDao.mockResolvedValue([]);

      await getSettlementService(mockIds, mockFilters, 1, 10, 'sno', 'DESC', Role.MERCHANT, 1, 'MERCHANT_OPERATIONS');

      expect(getSettlementDao).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: [2] }),
        1,
        10,
        'sno',
        'DESC',
        expect.any(Array)
      );
    });

    it('should apply user_id filter for VENDOR_OPERATIONS', async () => {
      getUserHierarchysDao.mockResolvedValue([{ config: { parent: 3 } }]);
      getSettlementDao.mockResolvedValue([]);

      await getSettlementService(mockIds, mockFilters, 1, 10, 'sno', 'DESC', Role.VENDOR, 1, 'VENDOR_OPERATIONS');

      expect(getSettlementDao).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: [3] }),
        1,
        10,
        'sno',
        'DESC',
        expect.any(Array)
      );
    });
  });

  describe('getSettlementsBySearchService', () => {
    it('should fetch settlements by search with valid parameters', async () => {
      const mockSettlementData = [{ id: 1, amount: 100 }];
      getSettlementsBySearchDao.mockResolvedValue(mockSettlementData);
      getUserHierarchysDao.mockResolvedValue([]);

      const result = await getSettlementsBySearchService(mockIds, mockFilters, 1, 10, 'sno', 'DESC', Role.MERCHANT, 1, 'MERCHANT');

      expect(getSettlementsBySearchDao).toHaveBeenCalledWith(
        expect.objectContaining({ company_id: mockIds.company_id }),
        1,
        10,
        'sno',
        'DESC',
        expect.any(Array),
        ['test'],
        Role.MERCHANT
      );
      expect(result).toEqual(mockSettlementData);
    });

    it('should throw BadRequestError if company_id is missing', async () => {
      await expect(getSettlementsBySearchService({}, mockFilters, 1, 10)).rejects.toThrow(BadRequestError);
    });

    it('should handle empty search terms', async () => {
      const mockSettlementData = [{ id: 1, amount: 100 }];
      getSettlementsBySearchDao.mockResolvedValue(mockSettlementData);
      getUserHierarchysDao.mockResolvedValue([]);

      await getSettlementsBySearchService(mockIds, { user_id: [1], search: '' }, 1, 10, 'sno', 'DESC', Role.MERCHANT, 1, 'MERCHANT');

      expect(getSettlementsBySearchDao).toHaveBeenCalledWith(
        expect.objectContaining({ company_id: mockIds.company_id }),
        1,
        10,
        'sno',
        'DESC',
        expect.any(Array),
        [],
        Role.MERCHANT
      );
    });
  });

  describe('createSettlementService', () => {
    it('should create settlement for INTERNAL_QR_TRANSFER with valid UTR', async () => {
      const mockSettlementResponse = {
        id: 1,
        status: Status.SUCCESS,
        approved_at: new Date(),
        method: 'INTERNAL_QR_TRANSFER'
      };
      getBankResponseByUTR.mockResolvedValue({ id: 1, is_used: false, status: Status.BOT });
      getVendorsDao.mockResolvedValue([{ id: 1, payin_commission: 0.1 }]);
      getCalculationforCronDao.mockResolvedValue([{ id: 1, config: { total_internalSettlement_amount: 0 } }]);
      calculateCommission.mockReturnValue(10);
      createSettlementDao.mockResolvedValue(mockSettlementResponse);
      updateBankResponseDao.mockResolvedValue();
      updateCalculationBalanceDao.mockResolvedValue();
      updateCalculationConfigDao.mockResolvedValue();

      const result = await createSettlementService(mockConn, { ...mockPayload, method: 'INTERNAL_QR_TRANSFER' }, Role.ADMIN);

      expect(getBankResponseByUTR).toHaveBeenCalledWith(mockPayload.config.reference_id);
      expect(createSettlementDao).toHaveBeenCalledWith(
        expect.objectContaining({ status: Status.SUCCESS, approved_at: expect.any(Date) }),
        mockConn
      );
      expect(result.id).toBe(1);
    });

    it('should throw InternalServerError if createSettlementDao returns undefined', async () => {
      getBankResponseByUTR.mockResolvedValue({ id: 1, is_used: false, status: Status.BOT });
      getVendorsDao.mockResolvedValue([{ id: 1, payin_commission: 0.1 }]);
      getCalculationforCronDao.mockResolvedValue([{ id: 1, config: { total_internalSettlement_amount: 0 } }]);
      createSettlementDao.mockResolvedValue(undefined);
    
      await expect(createSettlementService(mockConn, { ...mockPayload, method: 'INTERNAL_QR_TRANSFER' }, Role.ADMIN))
        .rejects.toThrow(InternalServerError);
    });

    it('should adjust negative amount to positive for INTERNAL_QR_TRANSFER and VENDOR role when debit_credit is SENT', async () => {
      createSettlementDao.mockResolvedValue({ id: 2 });
      const sentPayload = {
        ...mockPayload,
        config: { reference_id: 'UTR123', debit_credit: 'SENT' },
        amount: -100,
        method: 'INTERNAL_QR_TRANSFER',
        user_id: 1,
        company_id: 1,
        updated_by: 1,
      };
    
      const result = await createSettlementService(mockConn, sentPayload, Role.VENDOR);
    
      expect(createSettlementDao).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { reference_id: 'UTR123', debit_credit: 'SENT' },
          user_id: 1,
          amount: 100, // Verify amount is adjusted
          method: 'INTERNAL_QR_TRANSFER',
          company_id: 1,
          updated_by: 1,
        })
      );
      expect(result).toEqual({ id: 2 });
    });

    it('should throw NotFoundError if bank response not found', async () => {
      getBankResponseByUTR.mockResolvedValue(null);

      await expect(createSettlementService(mockConn, { ...mockPayload, method: 'INTERNAL_QR_TRANSFER' }, Role.ADMIN))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if bank response not found for non-VENDOR role', async () => {
      getBankResponseByUTR.mockResolvedValue(null);

      await expect(createSettlementService(mockConn, { ...mockPayload, method: 'INTERNAL_QR_TRANSFER' }, Role.ADMIN))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError if UTR is already used', async () => {
      getBankResponseByUTR.mockResolvedValue({ id: 1, is_used: true, status: Status.BOT });

      await expect(createSettlementService(mockConn, { ...mockPayload, method: 'INTERNAL_QR_TRANSFER' }, Role.ADMIN))
        .rejects.toThrow(BadRequestError);
    });

    it('should create settlement for non-internal transfer', async () => {
      createSettlementDao.mockResolvedValue({ id: 1 });

      const result = await createSettlementService(mockConn, { ...mockPayload, method: 'BANK' }, Role.MERCHANT);

      expect(createSettlementDao).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100, company_id : 1, config: mockPayload.config , method : "BANK" , updated_by: 1, user_id : 1 }),
        {}
      );
      expect(result).toEqual({ id: 1 });
    });

    it('should throw NotFoundError if vendor not found for INTERNAL_QR_TRANSFER', async () => {
      getBankResponseByUTR.mockResolvedValue({ id: 1, is_used: false, status: Status.BOT });
      getVendorsDao.mockResolvedValue([]);

      await expect(createSettlementService(mockConn, { ...mockPayload, method: 'INTERNAL_QR_TRANSFER' }, Role.ADMIN))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if calculation data not found for INTERNAL_QR_TRANSFER', async () => {
      getBankResponseByUTR.mockResolvedValue({ id: 1, is_used: false, status: Status.BOT });
      getVendorsDao.mockResolvedValue([{ id: 1, payin_commission: 0.1 }]);
      getCalculationforCronDao.mockResolvedValue([]);

      await expect(createSettlementService(mockConn, { ...mockPayload, method: 'INTERNAL_QR_TRANSFER' }, Role.ADMIN))
        .rejects.toThrow(NotFoundError);
    });

    it('should create settlement for invalid payment method with adjusted amount', async () => {
      createSettlementDao.mockResolvedValue({ id: 3 });
      const result = await createSettlementService(mockConn, { ...mockPayload, method: 'INVALID_METHOD' }, Role.MERCHANT);

      expect(createSettlementDao).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100, 
          company_id: 1,
          config: mockPayload.config,
          method: 'INVALID_METHOD',
          updated_by: 1,
          user_id: 1,
        }),{}
      );
      expect(result).toEqual({ id: 3 });
    });

    it('should create settlement for negative amount with debit_credit SENT for non-internal transfer', async () => {
      createSettlementDao.mockResolvedValue({ id: 4 });

      const negativePayload = {
        ...mockPayload,
        config: { debit_credit: 'SENT' },
        amount: -200,
        method: 'BANK',
      };

      const result = await createSettlementService(mockConn, negativePayload, Role.MERCHANT);

      expect(createSettlementDao).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: -200,
          company_id: 1,
          config: negativePayload.config,
          method: 'BANK',
          updated_by: 1,
          user_id: 1,
        }),
        {}
      );
      
      expect(result).toEqual({ id: 4 });
    });

    it('should throw InternalServerError if createSettlementDao fails', async () => {
      createSettlementDao.mockRejectedValue(new Error('DAO failure'));

      const payload = { ...mockPayload, method: 'BANK' };

      await expect(createSettlementService(mockConn, payload, Role.MERCHANT))
        .rejects.toThrow(InternalServerError);
      expect(createSettlementDao).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100,
          company_id: 1,
          config: mockPayload.config,
          method: 'BANK',
          updated_by: 1,
          user_id : 1
        }), {}
      );
    });

    it('should throw InternalServerError if getBankResponseByUTR fails for non-VENDOR role', async () => {
      getBankResponseByUTR.mockRejectedValue(new Error('Database error'));

      await expect(createSettlementService(mockConn, { ...mockPayload, method: 'INTERNAL_QR_TRANSFER' }, Role.ADMIN))
        .rejects.toThrow(InternalServerError);
      expect(getBankResponseByUTR).toHaveBeenCalledWith(mockPayload.config.reference_id);
    });
  });

  describe('updateSettlementService', () => {
    it('should update settlement with valid UTR', async () => {
      checkLockEdit.mockResolvedValue();
      getSettlementDao.mockResolvedValue([{ id: 1, user_id: 1, method: 'INTERNAL_QR_TRANSFER', role: Role.VENDOR, config: {} }]);
      getBankResponseByUTR.mockResolvedValue({ id: 1, is_used: false, status: Status.BOT });
      getCalculationforCronDao.mockResolvedValue([{ id: 1, config: { total_internalSettlement_amount: 0 } }]);
      getVendorsDao.mockResolvedValue([{ id: 1, payin_commission: 0.1 }]);
      calculateCommission.mockReturnValue(10);
      updateBankResponseDao.mockResolvedValue();
      updateCalculationBalanceDao.mockResolvedValue();
      updateCalculationConfigDao.mockResolvedValue();
      updateSettlementDao.mockResolvedValue({ id: 1 });

      const result = await updateSettlementService(mockConn, mockIds, { ...mockPayload, status: Status.SUCCESS });

      expect(updateSettlementDao).toHaveBeenCalled();
      expect(result).toEqual({ id: 1 });
    });

    it('should throw BadRequestError if UTR already exists', async () => {
      checkLockEdit.mockResolvedValue();
      getSettlementDao.mockResolvedValue([{ id: 1, config: { reference_id: 'UTR123' }, method: 'BANK' }]);

      await expect(updateSettlementService(mockConn, mockIds, { config: { reference_id: 'UTR123' } }))
        .rejects.toThrow(BadRequestError);
    });

    it('should handle REVERSED status for BANK method', async () => {
      checkLockEdit.mockResolvedValue();
      getSettlementDao.mockResolvedValue([{ id: 1, user_id: 1, method: 'BANK', role: Role.VENDOR, config: { bank_id: 1 } }]);
      getCalculationforCronDao.mockResolvedValue([{ id: 1, config: {} }]);
      getBeneficiaryAccountDao.mockResolvedValue([{ id: 1, config: { closing_balance: 1000 } }]);
      updateBeneficiaryAccountDao.mockResolvedValue();
      updateCalculationBalanceDao.mockResolvedValue();
      updateSettlementDao.mockResolvedValue({ id: 1 });

      const result = await updateSettlementService(mockConn, mockIds, { ...mockPayload, status: Status.REVERSED });

      expect(updateBeneficiaryAccountDao).toHaveBeenCalled();
      expect(result).toEqual({ id: 1 });
    });

    it('should throw BadRequestError when changing from REJECTED to SUCCESS', async () => {
      checkLockEdit.mockResolvedValue();
      getSettlementDao.mockResolvedValue([{ id: 1, status: Status.REJECTED, method: 'BANK', config: {} }]);

      await expect(updateSettlementService(mockConn, mockIds, { ...mockPayload, status: Status.SUCCESS }))
        .rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when updating to same status', async () => {
      checkLockEdit.mockResolvedValue();
      getSettlementDao.mockResolvedValue([{ id: 1, status: Status.SUCCESS, method: 'BANK', config: {} }]);

      await expect(updateSettlementService(mockConn, mockIds, { ...mockPayload, status: Status.SUCCESS }))
        .rejects.toThrow(BadRequestError);
    });

    it('should handle REJECTED status with rejected_reason', async () => {
      checkLockEdit.mockResolvedValue();
      getSettlementDao.mockResolvedValue([{ id: 1, user_id: 1, method: 'BANK', role: Role.MERCHANT, config: {} }]);
      getCalculationforCronDao.mockResolvedValue([{ id: 1, config: {} }]);
      updateCalculationBalanceDao.mockResolvedValue();
      updateSettlementDao.mockResolvedValue({ id: 1 });

      const result = await updateSettlementService(mockConn, mockIds, { ...mockPayload, config: { rejected_reason: 'Invalid data' } });

      expect(updateSettlementDao).toHaveBeenCalledWith(
        mockConn,
        { id: mockIds.id, company_id: mockIds.company_id },
        expect.objectContaining({ status: Status.REJECTED, rejected_at: expect.any(Date) })
      );
      expect(result).toEqual({ id: 1 });
    });

    it('should handle REJECTED status with rejected_reason', async () => {
      checkLockEdit.mockResolvedValue();
      getSettlementDao.mockResolvedValue([{ id: 1, user_id: 1, method: 'BANK', role: Role.MERCHANT, config: {} }]);
      getCalculationforCronDao.mockResolvedValue([{ id: 1, config: {} }]);
      updateSettlementDao.mockResolvedValue({ id: 1 });
    
      const result = await updateSettlementService(mockConn, mockIds, { 
        ...mockPayload, 
        config: { rejected_reason: 'Invalid data' } 
      });
    
      expect(updateCalculationBalanceDao).not.toHaveBeenCalled(); 
      expect(updateSettlementDao).toHaveBeenCalledWith(
        mockConn,
        { id: mockIds.id, company_id: mockIds.company_id },
        expect.objectContaining({ status: Status.REJECTED, rejected_at: expect.any(Date) })
      );
      expect(result).toEqual({ id: 1 });
    });
    
  });

  describe('deleteSettlementService', () => {
    it('should delete settlement', async () => {
      deleteSettlementDao.mockResolvedValue({ id: 1 });

      const result = await deleteSettlementService(mockConn, { ...mockIds, user_id: 1 });

      expect(deleteSettlementDao).toHaveBeenCalledWith(
        mockConn,
        { id: mockIds.id, company_id: mockIds.company_id },
        { is_obsolete: true, updated_by: 1 }
      );
      expect(result).toEqual({ id: 1 });
    });

    it('should throw error when deleteSettlementDao fails', async () => {
      const error = new Error('DAO error');
      deleteSettlementDao.mockRejectedValue(error);

      await expect(deleteSettlementService(mockConn, mockIds)).rejects.toThrow(error);
    });
  });
});