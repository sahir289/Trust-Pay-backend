import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { InternalServerError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
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
    const { merchant_id, vendor_id, startDate, endDate, method } = req.body;
    let result;
    if (merchant_id) {
      result = await getPayInMerchantReportDao(
        merchant_id,
        startDate,
        endDate,
        company_id,
      );
    }
    if (vendor_id) {
      const vendorData = await getVendorsDao({ id: vendor_id });
      const bankVendorData = await getBankaccountDao({
        user_id: vendorData.user_id,
      });
      result = await getPayInVendorReportDao(
        bankVendorData.id,
        startDate,
        endDate,
        method,
        company_id,
      );
    } else {
      result = await getPayinReportDao({ company_id: company_id });
    }
    return sendSuccess(res, result, 'got payin report');
  } catch (error) {
    console.error('error getting while fetching reports', error);
    throw new InternalServerError(error);
  }
};
const getPayOutReportService = async (req, res) => {
  try {
    const { company_id } = req.user;
    const { merchant_id, vendor_id, startDate, endDate, method } = req.body;
    let result;
    if (merchant_id) {
      result = await getPayOutMerchantReportDao(
        merchant_id,
        startDate,
        endDate,
        company_id,
      );
      return sendSuccess(res, result, 'Payouts created successfully');
    }
    if (vendor_id) {
      const vendorData = await getVendorsDao({ id: vendor_id });
      const bankData = await getBankaccountDao({ user_id: vendorData.user_id });
      result = await getPayOutVendorReportDao(
        bankData.id,
        startDate,
        endDate,
        method,
        company_id,
      );
      return sendSuccess(res, result, 'Payouts created successfully');
    } else {
      result = await getPayOutAll({ company_id: company_id });
      return sendSuccess(res, result, 'Payouts created successfully');
    }
  } catch (error) {
    console.error('error getting while fetching reports', error);
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
    const {page, limit} = req.query;

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
      const result = await getMerchantReportDao({ company_id: company_id}, null, null,
        page,limit,
        null,
        null,
        filterColumns ) ;
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
    const {page, limit} = req.query;
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
      const result = await getVendorReportDao({ company_id: company_id}, null, null,
        page,limit,
        null,
        null,
        filterColumns ) ;
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
