import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

jest.unstable_mockModule('../../src/utils/db.js', () => ({
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  getConnection: jest.fn(),
  rollback: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/merchants/merchantDao.js', () => ({
  createMerchantDao: jest.fn(),
  deleteMerchantDao: jest.fn(),
  getMerchantsDao: jest.fn().mockResolvedValue([{ id: 1 }]),
  getAllMerchantsDao: jest.fn().mockResolvedValue([{ id: 1 }]),
  getMerchantByCodeDao: jest.fn().mockResolvedValue([{ id: 1 }]),
  getMerchantsBySearchDao: jest.fn().mockResolvedValue({ merchants: [{ id: 1 }] }),
  updateMerchantDao: jest.fn().mockResolvedValue({ id: 1 }),
}));

jest.unstable_mockModule(
  '../../src/apis/calculation/calculationDao.js',
  () => ({
    createCalculationDao: jest.fn().mockResolvedValue({ id: 1, user_id: 1 }),
  }),
);

jest.unstable_mockModule(
  '../../src/apis/userHierarchy/userHierarchyDao.js',
  () => ({
    createUserHierarchyDao: jest.fn(),
    getUserHierarchysDao: jest.fn().mockResolvedValue([
      {
        config: {
          siblings: { sub_merchants: [] },
          child: { operations: [] },
        },
      },
    ]),
  }),
);

jest.unstable_mockModule('../../src/helpers/index.js', () => ({
  filterResponse: jest.fn((data) => data),
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), log: jest.fn() },
}));

jest.unstable_mockModule('../../src/constants/index.js', () => ({
  Role: { MERCHANT: 'MERCHANT' },
  columns: {},
}));

jest.unstable_mockModule(
  '../../src/apis/bankAccounts/bankaccountDao.js',
  () => ({
    getBankaccountDao: jest.fn().mockResolvedValue([]),
    updateBankaccountDao: jest.fn(),
  }),
);

jest.unstable_mockModule('../../src/apis/users/userDao.js', () => ({
  deleteUserDao: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/auth/authDao.js', () => ({
  getSessionByUserIdDao: jest.fn().mockResolvedValue([]),
}));

jest.unstable_mockModule('../../src/utils/sockets.js', () => ({
  forceLogoutUser: jest.fn(),
}));

let service, merchantDao, db, calculationDao, userHierarchyDao;

beforeAll(async () => {
  merchantDao = await import('../../src/apis/merchants/merchantDao.js');
  db = await import('../../src/utils/db.js');
  calculationDao = await import('../../src/apis/calculation/calculationDao.js');
  userHierarchyDao = await import('../../src/apis/userHierarchy/userHierarchyDao.js');
  service = await import('../../src/apis/merchants/merchantService.js');
});

beforeEach(() => {
  merchantDao.createMerchantDao = jest.fn();
  merchantDao.deleteMerchantDao = jest.fn();
  merchantDao.getMerchantsDao = jest.fn().mockResolvedValue([{ id: 1 }]);
  merchantDao.getAllMerchantsDao = jest.fn().mockResolvedValue([{ id: 1 }]);
  merchantDao.getMerchantByCodeDao = jest.fn().mockResolvedValue([{ id: 1 }]);
  merchantDao.getMerchantsBySearchDao = jest.fn().mockResolvedValue({ merchants: [{ id: 1 }] });
  merchantDao.updateMerchantDao = jest.fn().mockResolvedValue({ id: 1 });
  calculationDao.createCalculationDao = jest.fn().mockResolvedValue({ id: 1, user_id: 1 });
  userHierarchyDao.createUserHierarchyDao = jest.fn().mockResolvedValue({ id: 1 });
  userHierarchyDao.getUserHierarchysDao = jest.fn().mockResolvedValue([
    {
      config: {
        siblings: { sub_merchants: [] },
        child: { operations: [] },
      },
    },
  ]);
  db.commit = jest.fn();
  db.rollback = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('merchantService', () => {
  describe('createMerchantService', () => {
    it('should create merchant', async () => {
      merchantDao.createMerchantDao.mockResolvedValue({ id: 1, user_id: 1, company_id: 1, created_by: 1, updated_by: 1 });

      await service.createMerchantService({ code: 'TEST', role_id: 1, role: 'MERCHANT', designation: 'MERCHANT' });

      expect(merchantDao.createMerchantDao).toHaveBeenCalled();
    });
  });

  describe('getMerchantsService', () => {
    it('should call getMerchantsDao', async () => {
      merchantDao.getAllMerchantsDao.mockResolvedValue([{ id: 1 }]);

      await service.getMerchantsService({}, 'ADMIN', 1, 10, 'ADMIN', 1);

      expect(merchantDao.getAllMerchantsDao).toHaveBeenCalled();
    }, 10000);
  });

  describe('getMerchantsByCodeService', () => {
    it('should call getMerchantByCodeDao', async () => {
      merchantDao.getMerchantByCodeDao.mockResolvedValue([{ id: 1 }]);

      await service.getMerchantsByCodeService('TEST');

      expect(merchantDao.getMerchantByCodeDao).toHaveBeenCalled();
    });
  });

  describe('getMerchantsBySearchService', () => {
    it('should call getMerchantsBySearchDao', async () => {
      merchantDao.getMerchantsBySearchDao.mockResolvedValue({
        merchants: [{ id: 1 }],
      });

      await service.getMerchantsBySearchService({}, 'ADMIN');

      expect(merchantDao.getMerchantsBySearchDao).toHaveBeenCalled();
    });
  });

  describe('updateMerchantService', () => {
    it('should call updateMerchantDao', async () => {
      merchantDao.updateMerchantDao.mockResolvedValue({ id: 1 });

      await service.updateMerchantService({ id: 1 }, {}, 'ADMIN');

      expect(merchantDao.updateMerchantDao).toHaveBeenCalled();
    });
  });

  describe('deleteMerchantService', () => {
    it('should call deleteMerchantDao', async () => {
      merchantDao.deleteMerchantDao.mockResolvedValue({ id: 1 });

      await service.deleteMerchantService({ id: 1 }, 5, 'ADMIN');

      expect(merchantDao.deleteMerchantDao).toHaveBeenCalled();
    });
  });
});
