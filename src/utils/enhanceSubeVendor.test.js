import { enhanceVendorsWithSubVendors } from '../utils/enhanceSubVendor.js'; 
import { getUserHierarchysDao } from '../apis/userHierarchy/userHierarchyDao.js';
import { executeQuery } from './db.js';
import { Role } from '../constants/index.js';

// Mock dependencies
jest.mock('../apis/userHierarchy/userHierarchyDao.js');
jest.mock('./db.js');

describe('enhanceVendorsWithSubVendors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockVendors = [
    {
      user_id: 1,
      first_name: 'John',
      last_name: 'Doe',
      code: 'V001',
      payin_commission: 5,
      payout_commission: 3,
      created_at: '2023-01-01',
      updated_at: '2023-01-02',
    },
    {
      user_id: 2,
      first_name: 'Jane',
      last_name: 'Smith',
      code: 'V002',
      payin_commission: 4,
      payout_commission: 2,
      created_at: '2023-01-03',
      updated_at: '2023-01-04',
    },
  ];

  const mockUserHierarchy = [
    {
      user_id: 1,
      config: {
        siblings: {
          sub_vendors: [2],
        },
      },
    },
    {
      user_id: 2,
      config: {
        siblings: {
          sub_vendors: [],
        },
      },
    },
  ];

  const mockSubVendorData = [
    {
      id: 2,
      user_id: 2,
      first_name: 'Jane',
      last_name: 'Smith',
      code: 'V002',
      payin_commission: 4,
      payout_commission: 2,
      created_at: '2023-01-03',
      updated_at: '2023-01-04',
      full_name: 'Jane Smith',
      net_balance_limit: '1000',
      designation_name: 'Sub-Vendor',
      balance: 500,
    },
  ];

  test('should enhance vendors with sub-vendors when includeSeperateSubVendors is false', async () => {
    getUserHierarchysDao.mockResolvedValue(mockUserHierarchy);
    executeQuery.mockResolvedValue({ rows: mockSubVendorData });

    const result = await enhanceVendorsWithSubVendors(mockVendors);

    expect(result).toHaveLength(1); // Only main vendor (user_id: 1) should be included
    expect(result[0].user_id).toBe(1);
    expect(result[0].subVendors).toEqual(mockSubVendorData);
    expect(getUserHierarchysDao).toHaveBeenCalledTimes(3); // Twice in first pass, once in second pass for user_id 1
    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      expect.arrayContaining([[2]]),
    );
  });

  test('should include sub-vendors separately when includeSeperateSubVendors is true', async () => {
    getUserHierarchysDao.mockImplementation(({ user_id }) => {
      return Promise.resolve(mockUserHierarchy.filter((h) => h.user_id === user_id));
    });
    executeQuery.mockResolvedValue({ rows: mockSubVendorData });

    const result = await enhanceVendorsWithSubVendors(mockVendors, true);

    expect(result).toHaveLength(2); // Both vendors included
    expect(result[0].user_id).toBe(1);
    expect(result[0].subVendors).toEqual(mockSubVendorData); // Main vendor has sub-vendors
    expect(result[1].user_id).toBe(2);
    expect(result[1].subVendors).toEqual([]); // Sub-vendor has no sub-vendors
    expect(getUserHierarchysDao).toHaveBeenCalledTimes(4); // Twice in first pass, twice in second pass
  });

  test('should handle empty sub-vendor list', async () => {
    const mockHierarchyNoSubVendors = [
      {
        user_id: 1,
        config: {
          siblings: {
            sub_vendors: [],
          },
        },
      },
    ];
    getUserHierarchysDao.mockResolvedValue(mockHierarchyNoSubVendors);

    const result = await enhanceVendorsWithSubVendors([mockVendors[0]]);

    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe(1);
    expect(result[0].subVendors).toEqual([]);
    expect(executeQuery).not.toHaveBeenCalled(); // No sub-vendors to fetch
  });

  test('should include additional columns for admin role in getSubVendorsWithCompleteData', async () => {
    getUserHierarchysDao.mockResolvedValue(mockUserHierarchy);
    executeQuery.mockResolvedValue({ rows: mockSubVendorData });

    const result = await enhanceVendorsWithSubVendors(mockVendors, false, Role.ADMIN, 123);

    expect(result).toHaveLength(1);
    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('created_by,'),
      expect.arrayContaining([[2], 123]),
    );
  });

  test('should handle errors in getSubVendorsWithCompleteData gracefully', async () => {
    getUserHierarchysDao.mockResolvedValue(mockUserHierarchy);
    executeQuery.mockRejectedValue(new Error('Database error'));

    const result = await enhanceVendorsWithSubVendors(mockVendors);

    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe(1);
    expect(result[0].subVendors).toEqual([]); 
  });

  test('should filter by company_id when provided', async () => {
    getUserHierarchysDao.mockResolvedValue(mockUserHierarchy);
    executeQuery.mockResolvedValue({ rows: mockSubVendorData });

    await enhanceVendorsWithSubVendors(mockVendors, false, null, 123);

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('AND "Vendor"."company_id" = $2'),
      expect.arrayContaining([[2], 123]),
    );
  });

  test('should handle empty input data', async () => {
    const result = await enhanceVendorsWithSubVendors([]);

    expect(result).toEqual([]);
    expect(getUserHierarchysDao).not.toHaveBeenCalled();
    expect(executeQuery).not.toHaveBeenCalled();
  });
});