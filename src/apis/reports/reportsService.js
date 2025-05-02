
import moment from 'moment-timezone';
import { InternalServerError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import dayjs from "dayjs";
import {
  getMerchantReportDao,
  getPayInMerchantReportDao,
  getPayInVendorReportDao,
  getPayOutMerchantReportDao,
  getPayOutVendorReportDao,
  getVendorReportDao,
} from './reportsDao.js';
const IST = 'Asia/Kolkata';

const getPayInReportService = async (req, res) => {
  try {
    const { company_id } = req.user;
    const { code, startDate, endDate } = req.query;
    //for same date take 24 hours range
    const startDateTime = moment.tz(`${startDate} 00:00:00`, 'Asia/Kolkata').toISOString();
    const endDateTime = moment.tz(`${endDate} 23:59:59.999`, 'Asia/Kolkata').toISOString();
    let result = [];
    const codes = code.split(',');
    for (let codeItem of codes) {
      const merchant_id = await getMerchantsDao({ user_id: codeItem }, null, null, null, null);

      if (merchant_id && merchant_id.length > 0) {
        const merchantReport = await getPayInMerchantReportDao(
          merchant_id[0].id,  
          startDateTime,
          endDateTime,
          company_id
        );

        if (Array.isArray(merchantReport)) {
          result.push(...merchantReport);
        } else if (merchantReport) {
          result.push(merchantReport);  
        }
        //send success outside of forloop
      
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
        }
      }
      //if length is 0 nothing should appear
    }
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
    //for same date take 24 hours range
    const startDateTime = moment.tz(`${startDate} 00:00:00`, 'Asia/Kolkata').toISOString();
    const endDateTime = moment.tz(`${endDate} 23:59:59.999`, 'Asia/Kolkata').toISOString();
    let result = [];
    const codes = code.split(',');
    for (let codeItem of codes) {
      const merchant_id = await getMerchantsDao({ user_id: codeItem }, null, null, null, null);
      if (merchant_id && merchant_id.length > 0) {
        const merchantReport = await getPayOutMerchantReportDao(
          merchant_id[0].id,
          startDateTime,
          endDateTime,
          company_id
        );

        if (Array.isArray(merchantReport)) {
          result.push(...merchantReport);
        } else if (merchantReport) {
          result.push(merchantReport);
        }
        }
        //push outside of forloop

      const vendor_id = await getVendorsDao({ user_id: codeItem }, null, null, null, null);
      if (vendor_id && vendor_id.length > 0) {
            const vendorReport = await getPayOutVendorReportDao(
              vendor_id[0].id,
              startDateTime,
              endDateTime,
              company_id
            );

            if (Array.isArray(vendorReport)) {
              result.push(...vendorReport);
            } else if (vendorReport) {
              result.push(vendorReport);
            }        
      }
    }
//if length 0 nothing should appear 
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
    let startDateTime 
    let endDateTime
  
    if (startDateTime === endDateTime) {
       startDateTime = dayjs(startDate).tz(IST).toISOString();
       endDateTime = dayjs(endDate).tz(IST).endOf('day').toISOString();
    }

    let dataArray = [];
    let result
      const userIds = typeof code === 'string' ? code.split(',').map(id => id.trim()) : Array.isArray(code) ? code : [code];
      if(role_name === 'MERCHANT'){
         result = await getMerchantReportDao(
          company_id,
          userIds,
          startDate, endDate
          , page, limit
        ); 
        dataArray.push(result);
      }
      else{
        const userIds = typeof code === 'string' ? code.split(',').map(id => id.trim()) : Array.isArray(code) ? code : [code];
         result = await getVendorReportDao(
          company_id,
          userIds,
          startDate, endDate
          , page, limit
        );
        dataArray.push(result);
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
