import {
    enhanceMerchantsWithSubMerchants,
  } from './enhanceSubMerchant.js';
  import { getUserHierarchysDao } from '../apis/userHierarchy/userHierarchyDao.js';
  import { getMerchantByUserDao } from '../apis/merchants/merchantDao.js';
  
  jest.mock('../apis/userHierarchy/userHierarchyDao.js');
  jest.mock('../apis/merchants/merchantDao.js');
  
  describe('enhanceMerchantsWithSubMerchants', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should return merchants without subMerchants if no siblings', async () => {
      const merchants = [{ user_id: 1 }, { user_id: 2 }];
      
      getUserHierarchysDao.mockImplementation(() => {
        return Promise.resolve([{ config: { siblings: {} } }]);
      });
  
      const result = await enhanceMerchantsWithSubMerchants(merchants, 'Admin');
      expect(result).toEqual([
        { user_id: 1, subMerchants: [] },
        { user_id: 2, subMerchants: [] },
      ]);
      expect(getUserHierarchysDao).toHaveBeenCalledTimes(4); // 2 merchants * 2 calls each
    });
  
    it('should enhance merchants with subMerchants if siblings exist', async () => {
      const merchants = [{ user_id: 1 }];
  
      getUserHierarchysDao.mockImplementation(({ user_id }) => {
        if (user_id === 1) {
          return Promise.resolve([
            { config: { siblings: { sub_merchants: [2, 3] } } },
          ]);
        }
        return Promise.resolve([{ config: { siblings: {} } }]);
      });
  
      getMerchantByUserDao.mockImplementation((id, role) => {
        return Promise.resolve([{ user_id: id, role }]);
      });
  
      const result = await enhanceMerchantsWithSubMerchants(merchants, 'Admin');
      expect(result).toEqual([
        {
          user_id: 1,
          subMerchants: [
            { user_id: 2, role: 'Admin' },
            { user_id: 3, role: 'Admin' },
          ],
        },
      ]);
  
      expect(getMerchantByUserDao).toHaveBeenCalledTimes(2);
    });
  
    it('should skip merchants that are subMerchants of others', async () => {
      const merchants = [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }];
  
      getUserHierarchysDao.mockImplementation(({ user_id }) => {
        if (user_id === 1) {
          return Promise.resolve([{ config: { siblings: { sub_merchants: [2] } } }]);
        }
        return Promise.resolve([{ config: { siblings: {} } }]);
      });
  
      getMerchantByUserDao.mockResolvedValue([{ user_id: 2, role: 'Admin' }]);
  
      const result = await enhanceMerchantsWithSubMerchants(merchants, 'Admin');
  
      expect(result).toEqual([
        {
          user_id: 1,
          subMerchants: [{ user_id: 2, role: 'Admin' }],
        },
        {
          user_id: 3,
          subMerchants: [],
        },
      ]);
      expect(getUserHierarchysDao).toHaveBeenCalledTimes(5); // 3 merchants, some repeated
    });
  });
  