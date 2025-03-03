import { BadRequestError } from '../../utils/appErrors.js';
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
    throw new BadRequestError('Error getting while fetching reports');
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
    throw new BadRequestError('Error getting while fetching reports');
  }
};

const getMerchantReportService = async (req, res) => {
  try {
    const { company_id } = req.user;
    const { code, startDate, endDate } = req.query;
    ///api/data?code=123&code=456&startDate=2024-01-01&endDate=2024-01-31
    if (code) {
      const result = await getMerchantReportDao(
        code,
        startDate,
        endDate,
        company_id,
      );
      return sendSuccess(res, result, 'Reports fetched successfully');
    } else {
      const result = await getPayinReportDao({ company_id: company_id });
      return sendSuccess(res, result, 'Reports created successfully');
    }
  } catch (error) {
    console.error('error getting while fetching reports', error);
    throw new BadRequestError('Error getting while fetching reports');
  }
};

const getVendorReportService = async (req, res) => {
  try {
    const { company_id } = req.user;
    const {
      code,
      startDate,
      endDate,
      // , method
    } = req.query;
    if (code) {
      const vendorData = await getVendorsDao({ code: code });
      const vendorIds = vendorData.map((vendor) => vendor.user_id);

      const bankVendorData = await getBankaccountDao({ user_id: vendorIds });
      const bankIds = bankVendorData.map((bank) => bank.id);

      const result = await getVendorReportDao(
        bankIds,
        startDate,
        endDate,
        //  method ,
        company_id,
      );
      return sendSuccess(res, result, 'Reports created successfully');
    } else {
      const result = await getPayOutAll({ company_id: company_id });
      return sendSuccess(res, result, 'Reports created successfully');
    }
  } catch (error) {
    console.error('error getting while fetching reports', error);
    throw new BadRequestError('Error getting while fetching reports');
  }
};

export {
  getPayInReportService,
  getPayOutReportService,
  getMerchantReportService,
  getVendorReportService,
};
