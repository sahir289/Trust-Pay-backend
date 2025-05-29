
import moment from 'moment-timezone';
import { InternalServerError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getMerchantsDaoArray } from '../merchants/merchantDao.js';
import { getVendorsDaoArray } from '../vendors/vendorDao.js';
import {
  getMerchantReportDao,
  getPayInMerchantReportDao,
  getPayInVendorReportDao,
  getPayOutMerchantReportDao,
  getPayOutVendorReportDao,
  getVendorReportDao,
} from './reportsDao.js';

const getPayInReportService = async (req, res) => {
  try {
    const { company_id, role } = req.user;
    const { code, startDate, endDate } = req.query;
    const startDateTime = moment.tz(`${startDate} 00:00:00`, 'Asia/Kolkata').toISOString();
    const endDateTime = moment.tz(`${endDate} 23:59:59.999`, 'Asia/Kolkata').toISOString();
    const codes = code.split(',');
        let merchantIds = []
        let vendorIds = []
        let bankIds = []
        let result;
        const merchantDetails  =  await getMerchantsDaoArray(company_id, codes)
        merchantIds = merchantDetails.map(merchant => merchant.id);
        if(merchantIds.length>0){
          result =   await getPayInMerchantReportDao(merchantIds, startDateTime, endDateTime, company_id, role);
        }
        else{

          const vendorDetails  =  await getVendorsDaoArray(company_id, codes)
          bankIds = vendorDetails.map(banks => banks.user_id)
          const bankDetails  =  await getBankaccountDao({user_id:bankIds})
          vendorIds = bankDetails.map(merchant => merchant.id);
          result =   await getPayInVendorReportDao(vendorIds, startDateTime, endDateTime, company_id, role);
        }
    return sendSuccess(res, result, "Got Pay-In report");
  } catch (error) {
    console.error("Error while fetching reports", error);
    throw new InternalServerError(error);
  }
};

const getPayOutReportService = async (req, res) => {
  try {
    const { company_id, role } = req.user;
    const { code, startDate, endDate } = req.query;
    //optimised apis for faster 
    const startDateTime = moment.tz(`${startDate} 00:00:00`, 'Asia/Kolkata').toISOString();
    const endDateTime = moment.tz(`${endDate} 23:59:59.999`, 'Asia/Kolkata').toISOString();

    const codes = code.split(',');
    let merchantIds = []
    let vendorIds = []
    let result;
    const merchantDetails  =  await getMerchantsDaoArray(company_id, codes)
    merchantIds = merchantDetails.map(merchant => merchant.id);
    if(merchantIds.length>0){
      result =   await getPayOutMerchantReportDao(merchantIds, startDateTime, endDateTime, company_id, role);     
    } 
    else  {
      const vendorDetails  =  await getVendorsDaoArray(company_id, codes)
      vendorIds = vendorDetails.map(merchant => merchant.id);
      result =   await getPayOutVendorReportDao(vendorIds, startDateTime, endDateTime, company_id, role);
    }
    return sendSuccess(res, result, 'Payouts created successfully');
  } catch (error) {
    console.error('Error while fetching reports:', error);
    throw new InternalServerError(error);
  }
};

const getMerchantReportService = async (req, res) => {
  try {
    const { company_id } = req.user;
    const { code, startDate, endDate, role_name, page, limit } = req.query;
    //for same date take 24 hours range

  
    let result
      const userIds = typeof code === 'string' ? code.split(',').map(id => id.trim()) : Array.isArray(code) ? code : [code];
      if(role_name === 'MERCHANT'){
         result = await getMerchantReportDao(
          company_id,
          userIds,
          startDate, endDate
          , page, limit
        ); 
      }
      else{
        const userIds = typeof code === 'string' ? code.split(',').map(id => id.trim()) : Array.isArray(code) ? code : [code];
         result = await getVendorReportDao(
          company_id,
          userIds,
          startDate, endDate
          , page, limit
        );
      }
      return sendSuccess(res, result, 'Reports fetched successfully');
   
  } catch (error) {
    console.error('error getting while fetching reports', error);
    throw new InternalServerError(error);
  }
};

export {
  getPayInReportService,
  getPayOutReportService,
  getMerchantReportService,
};
