import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { InternalServerError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import {
  getMerchantReportDao,
  getPayinReportDao,
  getPayInMerchantReportDao,
  getPayInVendorReportDao,
  getPayOutMerchantReportDao,
  getPayOutVendorReportDao,
  getVendorReportDao,
  getPayOutAll,
} from './reportsDao.js';

const getPayInReportService = async (req, res) => {
  try {
    const { company_id } = req.user;
    const { code, startDate, endDate, method } = req.query;
    let result = [];
    const codes = code.split(',');
    for (let codeItem of codes) {
      const merchant_id = await getMerchantsDao({ user_id: codeItem }, null, null, null, null);

      if (merchant_id && merchant_id.length > 0) {
        const merchantReport = await getPayInMerchantReportDao(
          merchant_id[0].id,  
          startDate,
          endDate,
          company_id
        );

        if (Array.isArray(merchantReport)) {
          result.push(...merchantReport);
        } else if (merchantReport) {
          result.push(merchantReport);  
        }
        return sendSuccess(res, result, 'Payins created successfully');

      }
      const vendor_id = await getVendorsDao({ user_id: codeItem });
      if (vendor_id && vendor_id.length > 0) {
        const vendorData = await getVendorsDao({ id: vendor_id });
        if (vendorData) {
          const bankVendorData = await getBankaccountDao(
            { user_id: vendorData.user_id },
            null,
            null,
            "ADMIN"
          );
  
          if (bankVendorData) {
            const vendorReport = await getPayInVendorReportDao(
              bankVendorData.id,
              startDate,
              endDate,
              method,
              company_id
            );
            if (Array.isArray(vendorReport)) {
              result.push(...vendorReport);
            } else if (vendorReport) {
              result.push(vendorReport);  
            }
          }
        }
      }
    }


    if (result.length === 0) {
      result = await getPayinReportDao({ company_id });
    }

    return sendSuccess(res, result, "Got Pay-In report");
  } catch (error) {
    console.error("Error while fetching reports", error);
    throw new InternalServerError(error);
  }
};


const getPayOutReportService = async (req, res) => {
  try {
    const { company_id } = req.user;
    const { code, startDate, endDate, method } = req.query;
    let result = [];
    const codes = code.split(',');

    for (let codeItem of codes) {
      console.log(codeItem, "before search");

      const merchant_id = await getMerchantsDao({ user_id: codeItem }, null, null, null, null);
      console.log(merchant_id, "after merchant search");

      if (merchant_id && merchant_id.length > 0) {
        const merchantReport = await getPayOutMerchantReportDao(
          merchant_id[0].id,
          startDate,
          endDate,
          company_id
        );

        if (Array.isArray(merchantReport)) {
          result.push(...merchantReport);
        } else if (merchantReport) {
          result.push(merchantReport);
        }
        continue;  // Skip to the next iteration since this codeItem was processed
      }

      // If no merchant is found, check for vendor
      const vendor_id = await getVendorsDao({ user_id: codeItem });
      if (vendor_id) {
        const vendorData = await getVendorsDao({ id: vendor_id });
        if (vendorData) {
          const bankVendorData = await getBankaccountDao(
            { user_id: vendorData.user_id },
            null,
            null,
            "ADMIN"
          );

          if (bankVendorData) {
            const vendorReport = await getPayOutVendorReportDao(
              bankVendorData.id,
              startDate,
              endDate,
              method,
              company_id
            );

            if (Array.isArray(vendorReport)) {
              result.push(...vendorReport);
            } else if (vendorReport) {
              result.push(vendorReport);
            }
          }
        }
      }
    }

    // If no merchant or vendor reports were found, fetch all payouts
    if (result.length === 0) {
      result = await getPayOutAll({ company_id: company_id });
    }

    return sendSuccess(res, result, 'Payouts fetched successfully');
  } catch (error) {
    console.error('Error while fetching reports:', error);
    throw new InternalServerError(error);
  }
};


const getMerchantReportService = async (req, res) => {
  try {
    const { company_id, role } = req.user;
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CALCULATION
        : columns.CALCULATION;
    const { code, startDate, endDate } = req.query;
    const { page, limit } = req.query;

    ///api/data?code=123&code=456&startDate=2024-01-01&endDate=2024-01-31
    let dataArray = [];
    if (code) {
      const userIds = typeof code === 'string' ? code.split(',').map(id => id.trim()) : Array.isArray(code) ? code : [code];
      for (const user_id of userIds) {
        const result = await getMerchantReportDao(
          { user_id, company_id },
          startDate,
          endDate,
          null,
          null,
          null,
          null,
          filterColumns
        );

        dataArray.push(result);
      }

      return sendSuccess(res, dataArray, 'Reports fetched successfully');
    }
    else {
      const result = await getMerchantReportDao({ company_id: company_id }, null, null,
        page, limit,
        null,
        null,
        filterColumns);
      return sendSuccess(res, result, 'Reports created successfully');
    }
  } catch (error) {
    console.error('error getting while fetching reports', error);
    throw new InternalServerError(error);
  }
};

const getVendorReportService = async (req, res) => {
  try {
    const { company_id, role } = req.user;
    const filterColumns =
      role === Role.VENDOR ? vendorColumns.CALCULATION : columns.CALCULATION;
    const { code, startDate, endDate } = req.query;
    const { page, limit } = req.query;
    ///api/data?code=123&code=456&startDate=2024-01-01&endDate=2024-01-31
    let dataArray = [];
    if (code) {
      const userIds = typeof code === 'string' ? code.split(',').map(id => id.trim()) : Array.isArray(code) ? code : [code];
      for (const user_id of userIds) {
        const result = await getVendorReportDao(
          { user_id: user_id, company_id: company_id },
          startDate,
          endDate,
          null,
          null,
          null,
          null,
          filterColumns,
        );
        dataArray.push(result);
      }
      return sendSuccess(res, dataArray, 'Reports fetched successfully');
    } else {
      const result = await getVendorReportDao({ company_id: company_id }, null, null,
        page, limit,
        null,
        null,
        filterColumns);
      return sendSuccess(res, result, 'Reports created successfully');
    }
  } catch (error) {
    console.error('error getting while fetching reports', error);
    throw new InternalServerError(error);
  }
};

export {
  getPayInReportService,
  getPayOutReportService,
  getMerchantReportService,
  getVendorReportService,
};
