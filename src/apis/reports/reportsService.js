
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
    const { code, startDate, endDate } = req.query;
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
      const vendor_id = await getVendorsDao({ user_id: codeItem }, null, null, null, null);
      if (vendor_id && vendor_id.length > 0) {
          const bankVendorData = await getBankaccountDao(
            { user_id: codeItem },
            null,
            null,
            "ADMIN"
          );
          if (bankVendorData && bankVendorData.length > 0) {
            for (const bank of bankVendorData) {
            const vendorReport = await getPayInVendorReportDao(
              bank.id,
              startDate,
              endDate,
              company_id
            );
            if (Array.isArray(vendorReport)) {
              result.push(...vendorReport);
            } else if (vendorReport) {
              result.push(vendorReport);  
            }
          }
        
          return sendSuccess(res, result, 'Payouts created successfully');  }  
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
    const { code, startDate, endDate } = req.query;
    let result = [];
    const codes = code.split(',');

    for (let codeItem of codes) {
      const merchant_id = await getMerchantsDao({ user_id: codeItem }, null, null, null, null);
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
        return sendSuccess(res, result, 'Payouts created successfully');      }

      const vendor_id = await getVendorsDao({ user_id: codeItem }, null, null, null, null);
      if (vendor_id && vendor_id.length > 0) {
            const vendorReport = await getPayOutVendorReportDao(
              vendor_id[0].id,
              startDate,
              endDate,
              company_id
            );

            if (Array.isArray(vendorReport)) {
              result.push(...vendorReport);
            } else if (vendorReport) {
              result.push(vendorReport);
            }
            return sendSuccess(res, result, 'Payouts created successfully');    
          
        
      }
    }

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
    const { company_id,  role } = req.user;
    const { code, startDate, endDate, role_name, page, limit } = req.query;
    let dataArray = [];
    let result
      const userIds = typeof code === 'string' ? code.split(',').map(id => id.trim()) : Array.isArray(code) ? code : [code];
      if(role_name === 'MERCHANT'){
         result = await getMerchantReportDao(
          userIds,
          startDate,
          endDate,
          company_id, page, limit
        );
        dataArray.push(result);
      }
      else{
        const userIds = typeof code === 'string' ? code.split(',').map(id => id.trim()) : Array.isArray(code) ? code : [code];
         result = await getVendorReportDao(
          userIds,
          startDate,
          endDate,
          company_id, page, limit, role
        );
        dataArray.push(result);
      }
      return sendSuccess(res, result, 'Reports fetched successfully');
   
  } catch (error) {
    console.error('error getting while fetching reports', error);
    throw new InternalServerError(error);
  }
};

const getVendorReportService = async (req, res) => {
  try {
    const { company_id, role } = req.user;
    const { code, startDate, endDate } = req.query;
    const { page, limit } = req.query;
    let dataArray = [];
      const userIds = typeof code === 'string' ? code.split(',').map(id => id.trim()) : Array.isArray(code) ? code : [code];
      for (const user_id of userIds) {
        const result = await getVendorReportDao(
          user_id,
          startDate,
          endDate,
          company_id, page, limit, role
        );
        dataArray.push(result);
      }
      return sendSuccess(res, dataArray, 'Reports fetched successfully');
   
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
