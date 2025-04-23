import { getTotalCountDao } from './commonDao.js';
import { tableName, Role } from '../../constants/index.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';

export const getTotalCountService = async (tablename, role, filters, userInfo) => {
  try {

    const isMerchantOrVendor = userInfo.userRole === Role.MERCHANT || userInfo.userRole === Role.VENDOR;
    const isOperations = userInfo.designation === Role.MERCHANT_OPERATIONS || userInfo.designation === Role.VENDOR_OPERATIONS;
    let userIdFilter = [];

    // Helper to fetch user hierarchy
    const getHierarchy = async (userId) => (await getUserHierarchysDao({ user_id: userId }))?.[0];

    // Helper to fetch sub-merchants and operations
    const getSubMerchantsAndOps = async (hierarchy, includeOps = true) => {
      const subMerchants = hierarchy?.config?.siblings?.sub_merchants ?? [];
      const ops = includeOps ? (hierarchy?.config?.child?.operations ?? []) : [];
      const subOps = [];
      for (const subId of subMerchants) {
        const subHierarchy = await getHierarchy(subId);
        subOps.push(...(subHierarchy?.config?.child?.operations ?? []));
      }
      return [...subMerchants, ...ops, ...subOps];
    };

    const fetchMerchantIds = async (userIds) => (await getMerchantsDao({ user_id: userIds })).map(m => m.id);

    const fetchBankIds = async (userId) => (await getBankaccountDao({ user_id: userId, bank_used_for: 'PayIn' })).map(b => b.id);

    const fetchVendorIds = async (userIds) => (await getVendorsDao({ user_id: userIds })).map(v => v.id);

    const applyUserFilter = async (hierarchy, includeParent = false) => {
      userIdFilter.push(userInfo.user_id);
      if (includeParent && isOperations) {
        const parentId = hierarchy?.config?.parent;
        if (parentId) userIdFilter.push(parentId);
      }
      userIdFilter.push(...(await getSubMerchantsAndOps(hierarchy)));
      return [...new Set(userIdFilter)];
    };

    if (!isMerchantOrVendor) {
      return await getTotalCountDao(tablename, role, filters);
    }

    const hierarchy = await getHierarchy(userInfo.user_id);

    // Case 1: USER table
    if (tablename === tableName.USER) {
      userIdFilter = await applyUserFilter(hierarchy, true);
      if (isOperations && role === Role.MERCHANT) {
        const parentId = hierarchy?.config?.parent;
        if (parentId) {
          const parentHierarchy = await getHierarchy(parentId);
          userIdFilter.push(...(await getSubMerchantsAndOps(parentHierarchy)));
        }
      }
      filters.id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    // Case 2: MERCHANT or VENDOR table
    if (tablename === tableName.MERCHANT || tablename === tableName.VENDOR) {
      userIdFilter = isOperations ? [hierarchy?.config?.parent].filter(Boolean) : [userInfo.user_id];
      filters.user_id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    // Case 3: CHARGE_BACK table
    if (tablename === tableName.CHARGE_BACK) {
      userIdFilter = isOperations ? [hierarchy?.config?.parent].filter(Boolean) : [userInfo.user_id];
      userIdFilter.push(...(hierarchy?.config?.siblings?.sub_merchants ?? []));
      const filterKey = userInfo.userRole === Role.MERCHANT ? 'merchant_user_id' : 'vendor_user_id';
      filters[filterKey] = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    // Case 4: SETTLEMENT table
    if (tablename === tableName.SETTLEMENT) {
      userIdFilter = [userInfo.user_id];
      if (userInfo.userRole === Role.MERCHANT) {
        userIdFilter.push(...(hierarchy?.config?.siblings?.sub_merchants ?? []));
      }
      filters.user_id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    // Case 5: PAYIN table
    if (tablename === tableName.PAYIN) {
      if (userInfo.userRole === Role.MERCHANT) {
        userIdFilter = [userInfo.user_id];
        if (userInfo.designation === Role.MERCHANT) {
          const subMerchants = hierarchy?.config?.siblings?.sub_merchants ?? [];
          const merchantIds = await fetchMerchantIds([...userIdFilter, ...subMerchants]);
          userIdFilter.push(...merchantIds);
        } else if (userInfo.designation === Role.SUB_MERCHANT) {
          userIdFilter.push(...(await fetchMerchantIds([userInfo.user_id])));
        } else if (isOperations) {
          const parentId = hierarchy?.config?.parent;
          userIdFilter.push(parentId);
          if (parentId) {
            const parentHierarchy = await getHierarchy(parentId);
            const subMerchants = parentHierarchy?.config?.siblings?.sub_merchants ?? [];
            userIdFilter.push(...(await fetchMerchantIds([...new Set([parentId, ...subMerchants])])));
          }
        }
        filters.merchant_id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
      } else {
        const targetId = isOperations ? hierarchy?.config?.parent : userInfo.user_id;
        if (targetId) userIdFilter.push(...(await fetchBankIds(targetId)));
        filters.bank_acc_id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
      }
    }

    // Case 6: PAYOUT table
    if (tablename === tableName.PAYOUT) {
      if (userInfo.userRole === Role.MERCHANT) {
        userIdFilter = [userInfo.user_id];
        if (userInfo.designation === Role.MERCHANT) {
          const subMerchants = hierarchy?.config?.siblings?.sub_merchants ?? [];
          userIdFilter.push(...(await fetchMerchantIds([...userIdFilter, ...subMerchants])));
        } else if (userInfo.designation === Role.SUB_MERCHANT) {
          userIdFilter.push(...(await fetchMerchantIds([userInfo.user_id])));
        } else if (isOperations) {
          const parentId = hierarchy?.config?.parent;
          if (parentId) {
            const parentHierarchy = await getHierarchy(parentId);
            const subMerchants = parentHierarchy?.config?.siblings?.sub_merchants ?? [];
            userIdFilter.push(...(await fetchMerchantIds([...new Set([parentId, ...subMerchants])])));
          }
        }
        filters.merchant_id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
      } else {
        const targetId = isOperations ? hierarchy?.config?.parent : userInfo.user_id;
        if (targetId) userIdFilter.push(...(await fetchVendorIds([targetId])));
        filters.vendor_id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
      }
    }

    // Case 7: BANK_ACCOUNT table
    if (tablename === tableName.BANK_ACCOUNT && userInfo.userRole === Role.VENDOR) {
      userIdFilter = isOperations ? [hierarchy?.config?.parent].filter(Boolean) : [userInfo.user_id];
      filters.user_id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    return await getTotalCountDao(tablename, role, filters);
  } catch (error) {
    console.error(`Error in getTotalCountService for table ${tablename}:`, error);
    throw error;
  }
};