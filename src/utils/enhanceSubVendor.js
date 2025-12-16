import { getUserHierarchysDao } from '../apis/userHierarchy/userHierarchyDao.js';
import { executeQuery } from './db.js';
import { Role } from '../constants/index.js';
import { logger } from './logger.js';

export async function enhanceVendorsWithSubVendors(
  data,
  includeSeperateSubVendors = false,
  role = null,
  company_id = null,
  conn = null,
) {
  const subVendorUserIds = new Set();

  // First pass: collect all sub-vendor user IDs
  for (const vendor of data) {
    const userHierarchys = await getUserHierarchysDao({
      user_id: vendor.user_id,
    }, null , null, null, null, null, conn);
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
    }, null , null, null, null, null, conn);
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

    // Fetch sub-vendor data with the same structure as main vendors
    if (subVendorIds.length > 0) {
      const subVendorData = await getSubVendorsWithCompleteData(
        subVendorIds,
        role,
        company_id,
        conn,
      );
      subVendors.push(...subVendorData);
    }

    vendor.subVendors = subVendors;

    result.push(vendor);
  }

  return result;
}

// Helper function to get sub-vendor data with the same structure as main vendors
async function getSubVendorsWithCompleteData(userIds, role, company_id, conn = null) {
  try {
    // Build the same columns as getVendorsBySearchDao
    const columns = [
      `"Vendor".id`,
      `"Vendor".user_id`,
      `"Vendor".first_name`,
      `"Vendor".last_name`,
      `"Vendor".code`,
      `"Vendor".payin_commission`,
      `"Vendor".payout_commission`,
      `"Vendor".created_at`,
      `"Vendor".updated_at`,
      `"user_main".first_name || ' ' || "user_main".last_name AS full_name`,
      `"Vendor".config->>'net_balance' AS net_balance_limit`,
      `"d".designation AS designation_name`,
      `(SELECT net_balance FROM "Calculation" WHERE "Calculation".user_id = "Vendor".user_id ORDER BY "Calculation".created_at DESC LIMIT 1) AS balance`,
    ];

    // Add extra columns for admin
    if (role === Role.ADMIN) {
      columns.push(
        `"Vendor".created_by`,
        `"Vendor".updated_by`,
        `"Vendor".company_id`,
        `"Vendor".config`,
        `COALESCE("Vendor".config->>'is_owned') AS is_owned`,
        `"user_main".designation_id`,
        `u.user_name AS created_by`,
        `uu.user_name AS updated_by`,
      );
    }

    let queryText = `
      SELECT 
      ${columns.join(',\n')}
      FROM "Vendor"
      JOIN "User" AS user_main ON "Vendor".user_id = user_main.id
      LEFT JOIN "Designation" AS d ON user_main.designation_id = d.id
      ${
        role === Role.ADMIN
          ? `LEFT JOIN "User" AS u ON "Vendor".created_by = u.id
         LEFT JOIN "User" AS uu ON "Vendor".updated_by = uu.id`
          : ''
      }
      WHERE "Vendor".is_obsolete = false
      AND "Vendor"."user_id" = ANY($1)
    `;

    const values = [userIds];
    let paramIndex = 2;

    // Add company_id filter if provided
    if (company_id) {
      queryText += ` AND "Vendor"."company_id" = $${paramIndex}`;
      values.push(company_id);
      paramIndex++;
    }

    queryText += ` ORDER BY "Vendor"."updated_at" DESC`;

    const result = await executeQuery(queryText, values, conn);
    return result.rows;
  } catch (error) {
    logger.error(
      'Error fetching sub-vendor data with complete structure:',
      error,
    );
    return [];
  }
}
