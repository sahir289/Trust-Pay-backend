// ============================================
// VENDOR FACTORY - Unified Payout Creation
// ============================================

import { logger } from '../utils/logger.js';

// Import all vendor payout creators
import { createTataPayBulkPayout, createTataPayPayout } from '../tatapay/tatapay.js';
import { createClickrrPayout, getClickrrWalletBalance } from '../clickrr/clickrr.js';
import { createPayAssistPayout, getPayAssistWalletBalance } from '../payassist/payassist.js';
import { createPayDumPayout } from '../paydum/paydum.js';
import { createRupeeFlowBulkPayout, createRupeeFlowPayout } from '../rupeeflow/rupeeflow.js';
import { createBSSPayout } from '../bss/bss.js';
import { createSilkPayPayout } from '../silkpay/silkpay.js';
import { createBSS02Payout } from '../bss/bss02.js';
import { createBSS03Payout } from '../bss/bss03.js';
import { createVertexPayPayout } from '../vertexpay/vertexpay.js';
import { createRunsafePayPayout } from '../runsafe/runsafepay.js';

// Vendor method mappings
const VENDOR_METHODS = {
  tatapay: {
    create: createTataPayPayout,
    createBulk: createTataPayBulkPayout,
  },
  clickrr: {
    create: createClickrrPayout,
    walletBalance: getClickrrWalletBalance,
  },
  payassist: {
    create: createPayAssistPayout,
    walletBalance: getPayAssistWalletBalance,
  },
  paydum: {
    create: createPayDumPayout,
  },
  rupeeflow: {
    create: createRupeeFlowPayout,
    createBulk: createRupeeFlowBulkPayout,
  },
  bss: {
    create: createBSSPayout,
  },
  silkpay: {
    create: createSilkPayPayout,
  },
  bss02: {
    create: createBSS02Payout,
  },
  bss03: {
    create: createBSS03Payout,
  },
  vertexpay: {
    create: createVertexPayPayout,
  },
  runsafepay: {
    create: createRunsafePayPayout,
  },
};

/**
 * Create a payout using the specified vendor
 * @param {string} vendorName - Name of the vendor (e.g., 'tatapay', 'clickrr')
 * @param {Object} payload - Payout data
 * @returns {Promise<Object>} Payout result
 */
export const createVendorPayout = async (vendorName, payload) => {
  const vendor = VENDOR_METHODS[vendorName?.toLowerCase()];
  
  if (!vendor?.create) {
    logger.error(`Vendor ${vendorName} not found or create method not available`);
    throw new Error(`Vendor ${vendorName} is not supported`);
  }
  
  return vendor.create(payload);
};

/**
 * Create bulk payouts using the specified vendor
 * @param {string} vendorName - Name of the vendor
 * @param {Object} payload - Bulk payout data
 * @returns {Promise<Object>} Bulk payout result
 */
export const createVendorBulkPayout = async (vendorName, payload) => {
  const vendor = VENDOR_METHODS[vendorName?.toLowerCase()];
  
  if (!vendor?.createBulk) {
    logger.error(`Vendor ${vendorName} does not support bulk payouts`);
    throw new Error(`Vendor ${vendorName} does not support bulk payouts`);
  }
  
  return vendor.createBulk(payload);
};

/**
 * Get wallet balance from vendor (if supported)
 * @param {string} vendorName - Name of the vendor
 * @returns {Promise<number>} Wallet balance
 */
export const getVendorWalletBalance = async (vendorName) => {
  const vendor = VENDOR_METHODS[vendorName?.toLowerCase()];
  
  if (!vendor?.walletBalance) {
    logger.warn(`Vendor ${vendorName} does not support wallet balance查询`);
    return null;
  }
  
  return vendor.walletBalance();
};

/**
 * Check if a vendor supports bulk payouts
 * @param {string} vendorName - Name of the vendor
 * @returns {boolean} True if bulk payouts are supported
 */
export const vendorSupportsBulk = (vendorName) => {
  const vendor = VENDOR_METHODS[vendorName?.toLowerCase()];
  return !!vendor?.createBulk;
};

/**
 * Get list of all available vendors
 * @returns {string[]} Array of vendor names
 */
export const getAvailableVendors = () => Object.keys(VENDOR_METHODS);

/**
 * Get vendor capabilities
 * @param {string} vendorName - Name of the vendor
 * @returns {Object} Vendor capabilities
 */
export const getVendorCapabilities = (vendorName) => {
  const vendor = VENDOR_METHODS[vendorName?.toLowerCase()];
  if (!vendor) return null;
  
  return {
    hasCreate: !!vendor.create,
    hasBulk: !!vendor.createBulk,
    hasWalletBalance: !!vendor.walletBalance,
  };
};

// Export individual vendor methods for backward compatibility
export {
  createTataPayPayout,
  createTataPayBulkPayout,
  createClickrrPayout,
  getClickrrWalletBalance,
  createPayAssistPayout,
  getPayAssistWalletBalance,
  createPayDumPayout,
  createRupeeFlowPayout,
  createRupeeFlowBulkPayout,
  createBSSPayout,
  createSilkPayPayout,
  createBSS02Payout,
  createBSS03Payout,
  createVertexPayPayout,
  createRunsafePayPayout,
};