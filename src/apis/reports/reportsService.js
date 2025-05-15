
import moment from 'moment-timezone';
import { InternalServerError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
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
    const { company_id } = req.user;
    const { code, startDate, endDate } = req.query;
    //for same date take 24 hours range  -- dates formatting as per db -- for both vendor and merchant
    const startDateTime = moment.tz(`${startDate} 00:00:00`, 'Asia/Kolkata').toISOString();
    const endDateTime = moment.tz(`${endDate} 23:59:59.999`, 'Asia/Kolkata').toISOString();
    //optimised apis for faster 
    const codes = code.split(',');
    const result = [];

    const [merchantData, vendorData] = await Promise.all([
      Promise.all(codes.map(codeItem => getMerchantsDao({ user_id: codeItem }, null, null, null, null))),
      Promise.all(codes.map(codeItem => getVendorsDao({ user_id: codeItem }, null, null, null, null)))
    ]);

    const merchantReports = await Promise.all(
      merchantData
        .map((merchant_id) => {
          if (merchant_id?.length > 0) {
            return getPayInMerchantReportDao(merchant_id[0].id, startDateTime, endDateTime, company_id);
          }
          return null;
        })
        .filter(Boolean)
    );

    merchantReports.forEach(report => {
      if (report) {
        result.push(...(Array.isArray(report) ? report : [report]));
      }
    });

    const vendorBankData = await Promise.all(
      vendorData
        .map((vendor_id, index) => {
          if (vendor_id?.length > 0) {
            return getBankaccountDao({ user_id: codes[index] }, null, null, "ADMIN");
          }
          return null;
        })
        .filter(Boolean)
    );

    const vendorReports = await Promise.all(
      vendorBankData.flatMap((bankData) => {
        if (bankData?.length > 0) {
          return bankData.map(bank =>
            getPayInVendorReportDao(bank.id, startDate, endDate, company_id)
          );
        }
        return [];
      })
    );

    vendorReports.forEach(report => {
      if (report) {
        result.push(...(Array.isArray(report) ? report : [report]));
      }
    });

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
    //optimised apis for faster 
    const startDateTime = moment.tz(`${startDate} 00:00:00`, 'Asia/Kolkata').toISOString();
    const endDateTime = moment.tz(`${endDate} 23:59:59.999`, 'Asia/Kolkata').toISOString();

    const codes = code.split(',');
    const result = [];

    const [merchantData, vendorData] = await Promise.all([
      Promise.all(codes.map(codeItem => getMerchantsDao({ user_id: codeItem }, null, null, null, null))),
      Promise.all(codes.map(codeItem => getVendorsDao({ user_id: codeItem }, null, null, null, null)))
    ]);

    const merchantReports = await Promise.all(
      merchantData
        .map((merchant_id) => {
          if (merchant_id?.length > 0) {
            return getPayOutMerchantReportDao(merchant_id[0].id, startDateTime, endDateTime, company_id);
          }
          return null;
        })
        .filter(Boolean)
    );

    merchantReports.forEach(report => {
      if (report) {
        result.push(...(Array.isArray(report) ? report : [report]));
      }
    });

    const vendorReports = await Promise.all(
      vendorData
        .map((vendor_id) => {
          if (vendor_id?.length > 0) {
            return getPayOutVendorReportDao(vendor_id[0].id, startDateTime, endDateTime, company_id);
          }
          return null;
        })
        .filter(Boolean)
    );

    vendorReports.forEach(report => {
      if (report) {
        result.push(...(Array.isArray(report) ? report : [report]));
      }
    });

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
