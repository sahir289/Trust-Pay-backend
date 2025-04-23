import { getTotalCountDao } from './commonDao.js';
import { tableName } from '../../constants/index.js';
import { Role } from '../../constants/index.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
export const getTotalCountService = async (tablename, role, filters,userInfo) => {
  try {
    console.log(filters,"hey filters")
    console.log(userInfo, "hey user from the");
//     {
//   userRole: 'MERCHANT',
//   designation: 'MERCHANT',
//   user_id: '6b284162-6ab9-44b6-9112-3028abb887e2',
//   company_id: '2cb29af7-21c1-442a-969f-a90e06c772ca'
    // }
        let userIdFilter = [];

    console.log(tablename, role, filters);
    if ((tablename === tableName.USER) && (userInfo.userRole === Role.MERCHANT || userInfo.userRole === Role.VENDOR)) {
      const userHierarchyData = await getUserHierarchysDao({ user_id:userInfo.user_id });
      const userHierarchy = userHierarchyData[0];
      console.log(userHierarchy, 'userhierachy');
      if (userInfo.designation === Role.MERCHANT_OPERATIONS || userInfo.designation === Role.VENDOR_OPERATIONS) {
        const parentUserId = userHierarchy?.config?.parent;
        if (parentUserId) {
          userIdFilter.push(parentUserId);
          const parentHierarchyData = await getUserHierarchysDao({
            user_id: parentUserId,
          });
          const parentHierarchy = parentHierarchyData[0];

          if (role === Role.MERCHANT) {
            const subMerchants =
              parentHierarchy?.config?.siblings?.sub_merchants ?? [];
            userIdFilter.push(...subMerchants);

            // Fetch child.operations from each submerchant
            for (const subId of subMerchants) {
              const subHierarchyData = await getUserHierarchysDao({
                user_id: subId,
              });
              const subHierarchy = subHierarchyData?.[0];
              const subOps = subHierarchy?.config?.child?.operations ?? [];
              userIdFilter.push(...subOps);
            }
          }

          const parentOps = parentHierarchy?.config?.child?.operations ?? [];
          userIdFilter.push(...parentOps);
        }
      }
      else {
         userIdFilter.push(userInfo.user_id);
         const subMerchants = userHierarchy?.config?.siblings?.sub_merchants ?? [];
         userIdFilter.push(...subMerchants);
         console.log(subMerchants);
         // Add submerchant child.operations
         for (const subId of subMerchants) {
           const subHierarchyData = await getUserHierarchysDao({
             user_id: subId,
           });
           const subHierarchy = subHierarchyData?.[0];
           const subOps = subHierarchy?.config?.child?.operations ?? [];
           userIdFilter.push(...subOps);
         }

         const childOperations = userHierarchy?.config?.child?.operations ?? [];
         userIdFilter.push(...childOperations);
      }
      userIdFilter = [...new Set(userIdFilter)];
      filters.id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    
    }
    if ((tablename === tableName.MERCHANT || tablename === tableName.VENDOR) && (userInfo.userRole === Role.MERCHANT || userInfo.userRole === Role.VENDOR)) {
       const userHierarchyData = await getUserHierarchysDao({
         user_id: userInfo.user_id,
       });
      const userHierarchy = userHierarchyData[0];
      if (userInfo.designation === Role.MERCHANT_OPERATIONS || userInfo.designation === Role.VENDOR_OPERATIONS) {
        const parentUserId = userHierarchy?.config?.parent;
        userIdFilter.push(parentUserId);
      }
      else {
       userIdFilter.push(userInfo.user_id);
      }
     filters.user_id =userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }
     if (
       (tablename === tableName.CHARGE_BACK ) &&
       (userInfo.userRole === Role.MERCHANT ||
         userInfo.userRole === Role.VENDOR)
     ) {
       const userHierarchyData = await getUserHierarchysDao({
         user_id: userInfo.user_id,
       });
       const userHierarchy = userHierarchyData[0];
       if (
         userInfo.designation === Role.MERCHANT_OPERATIONS ||
         userInfo.designation === Role.VENDOR_OPERATIONS
       ) {
         const parentUserId = userHierarchy?.config?.parent;
      
         userIdFilter.push(parentUserId);
         const userHierarchyData = await getUserHierarchysDao({
           user_id: userInfo.user_id,
         });
           const subMerchants =
             userHierarchyData?.config?.siblings?.sub_merchants ?? [];
           userIdFilter.push(...subMerchants);
       } else {
         userIdFilter.push(userInfo.user_id);
         const subMerchants =userHierarchy?.config?.siblings?.sub_merchants ?? [];
         userIdFilter.push(...subMerchants);
       }
       if (userInfo.userRole === Role.MERCHANT) {
         filters.merchant_user_id =
           userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
       } else {
         filters.vendor_user_id =
           userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
       }
     }
    if ((userInfo.userRole === Role.MERCHANT || userInfo.userRole === Role.VENDOR)&& tablename === tableName.SETTLEMENT) {
      if (userInfo.userRole === Role.MERCHANT) {
        userIdFilter.push(userInfo.user_id);
        const userHierarchys = await getUserHierarchysDao({
          user_id: userInfo.user_id,
        });
        if (userHierarchys || userHierarchys.length > 0) {
          const userHierarchy = userHierarchys[0];

          if (
            userHierarchy?.config ||
            Array.isArray(userHierarchy?.config?.siblings?.sub_merchants)
          ) {
            userIdFilter = [
              ...userIdFilter,
              ...(userHierarchy?.config?.siblings?.sub_merchants ?? []),
            ];
          }
        }
      }
        else {
        userIdFilter.push(userInfo.user_id);
        }
      filters.user_id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }
    ///for payin table
     const fetchMerchantIds = async (user_ids) => {
       const merchants = await getMerchantsDao({ user_id: user_ids });
       return merchants.map((merchant) => merchant.id);
     };

     const fetchBankIds = async (user_id) => {
       const banks = await getBankaccountDao({
         user_id,
         bank_used_for: 'PayIn',
       });
       return banks.map((bank) => bank.id);
     };
  if (
    (userInfo.userRole === Role.MERCHANT ||
      userInfo.userRole === Role.VENDOR) &&
    tablename === tableName.PAYIN
  ) {
    console.log('hii user from the userrs');
    let merchant_user_id =
      userInfo.userRole === Role.MERCHANT ? [userInfo.user_id] : [];

    if (userInfo.userRole === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao({
        user_id: userInfo.user_id,
      });
      const userHierarchy = userHierarchys?.[0];
      userIdFilter.push(userInfo.user_id);

      if (userInfo.designation === Role.MERCHANT && userHierarchy) {
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        if (Array.isArray(subMerchants) && subMerchants.length > 0) {
          merchant_user_id = [...merchant_user_id, ...subMerchants];
          const merchantIds = await fetchMerchantIds(merchant_user_id);
          userIdFilter.push(...merchantIds); // Spread to avoid nesting
        } else {
          const merchantIds = await fetchMerchantIds([userInfo.user_id]);
          userIdFilter.push(...merchantIds);
        }
      } else if (userInfo.designation === Role.SUB_MERCHANT) {
        const merchantIds = await fetchMerchantIds([userInfo.user_id]);
        userIdFilter.push(...merchantIds);
      } else if (
        userInfo.designation === Role.MERCHANT_OPERATIONS &&
        userHierarchy
      ) {
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentID,
          });
          const parentHierarchy = parentHierarchys?.[0];
          const subMerchants =
            parentHierarchy?.config?.siblings?.sub_merchants ?? [];
          const uniqueUserIds = [...new Set([parentID, ...subMerchants])];
          const merchantIds = await fetchMerchantIds(uniqueUserIds);
          userIdFilter.push(...merchantIds); // Update outer userIdFilter
        }
      }
    } else if (userInfo.userRole === Role.VENDOR) {
      if (userInfo.designation === Role.VENDOR) {
        const bankIds = await fetchBankIds(userInfo.user_id);
        userIdFilter.push(...bankIds);
      } else if (userInfo.designation === Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({
          user_id: userInfo.user_id,
        });
        const parentID = userHierarchys?.[0]?.config?.parent;
        if (parentID) {
          const bankIds = await fetchBankIds(parentID);
          userIdFilter.push(...bankIds);
        }
      }
    }

    // Assign filters based on role
    if (userInfo.userRole === Role.MERCHANT) {
      filters.merchant_id =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    } else {
      filters.bank_acc_id =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }
  }
    return await getTotalCountDao(tablename, role, filters);
  } catch (error) {
    console.error(
      `Error in getTotalCountService for table ${tablename}:`,
      error,
    );
    throw error;
  }
};
