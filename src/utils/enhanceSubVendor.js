import { getVendorByUserDao } from '../apis/vendors/vendorDao.js';
import { getUserHierarchysDao } from '../apis/userHierarchy/userHierarchyDao.js';

export async function enhanceVendorsWithSubVendors(data, includeSeperateSubVendors = false) {
  const subVendorUserIds = new Set();
  
  // First pass: collect all sub-vendor user IDs
  for (const vendor of data) {
    const userHierarchys = await getUserHierarchysDao({
      user_id: vendor.user_id,
    });
    const userHierarchy = userHierarchys[0];
    
    if (userHierarchy?.config?.siblings?.sub_vendors) {
      const subVendors = userHierarchy.config.siblings.sub_vendors;
      subVendors.forEach((id) => subVendorUserIds.add(id));
    }
  }
  
  const result = [];
  
  // Second pass: enhance vendors with sub-vendor data
  for (const vendor of data) {
    
    // If includeSeperateSubVendors is true, don't filter out sub-vendors
    if (!includeSeperateSubVendors && subVendorUserIds.has(vendor.user_id)) {
      continue;
    }
    
    const userHierarchys = await getUserHierarchysDao({
      user_id: vendor.user_id,
    });
    const userHierarchy = userHierarchys[0];
    
    // If no sub-vendors, add empty array and continue
    if (!userHierarchy?.config?.siblings?.sub_vendors) {
      vendor.subVendors = [];
      result.push(vendor);
      continue;
    }
    
    // Get sub-vendor data only for main vendors (not for sub-vendors themselves)
    // If includeSeperateSubVendors is true, don't add nested subVendors for sub-vendors
    if (includeSeperateSubVendors && subVendorUserIds.has(vendor.user_id)) {
      vendor.subVendors = [];
      result.push(vendor);
      continue;
    }
    
    const subVendorIds = userHierarchy.config.siblings.sub_vendors;
    const subVendors = [];
    
    for (const id of subVendorIds) {
      const subVendorData = await getVendorByUserDao(id);
      if (subVendorData && subVendorData.length > 0) {
        subVendors.push(subVendorData[0]);
      }
    }
    
    vendor.subVendors = subVendors;
    
    result.push(vendor);
  }
  
  return result;
}