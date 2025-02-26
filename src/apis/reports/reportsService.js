import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountDao, getBankaccountDaoAll } from '../bankAccounts/bankaccountDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { getMerchantReportDao, getMerchantReportDaoAll, getPayInMerchantReportDao, getPayInVendorReportDao, getPayOutMerchantReportDao, getPayOutVendorReportDao } from './reportsDao.js';

const getPayInReportService = async (req, res) => {
    try {

        const { merchant_id, vendor_id, startDate, endDate, method } = req.body;
        let result;
        if (merchant_id) {
            result = await getPayInMerchantReportDao(merchant_id, startDate, endDate);
        }
        if (vendor_id) {
            const vendorData = await getVendorsDao({ id: vendor_id })
            const bankVendorData = await getBankaccountDao({ user_id: vendorData.user_id });
            result = await getPayInVendorReportDao(bankVendorData.id, startDate, endDate, method);
        }
         return sendSuccess(res, result, "got payin report")
    } catch (error) {
        console.error('error getting while fetching reports', error);
        throw new BadRequestError('Error getting while fetching reports');
    }
};
const getPayOutReportService = async (req, res) => {
    try {
        const { merchant_id, vendor_id, startDate, endDate, method } = req.body;
        let result;
        if (merchant_id) {
            result = await getPayOutMerchantReportDao(merchant_id, startDate, endDate);
            return sendSuccess(res, result, 'Payouts created successfully'); 
        }
        if (vendor_id) {
            const vendorData = await getVendorsDao({ id: vendor_id });
            const bankData = await getBankaccountDao({user_id: vendorData.user_id});
            result = await getPayOutVendorReportDao(bankData.id, startDate, endDate, method);
            return sendSuccess(res, result, 'Payouts created successfully'); 
        }
    } catch (error) {
        console.error('error getting while fetching reports', error);
        throw new BadRequestError('Error getting while fetching reports');
    }
}; const getMerchantReportService = async (req, res) => {
    try {
       
        const { merchant_id, startDate, endDate } = req.query;
        if(merchant_id){
        const result = await getMerchantReportDao(merchant_id, startDate, endDate);
        return sendSuccess(res, result, 'Payins created successfully');
        }
        else{
            const result = await getMerchantReportDaoAll();
            return sendSuccess(res, result, 'Payins created successfully'); 
        }
    } catch (error) {
        console.error('error getting while fetching reports', error);
        throw new BadRequestError('Error getting while fetching reports');
    }
}
 const getVendorReportService = async (req, res) => {
    try {
        const { vendor_id, startDate, endDate, method } = req.query;
        if(vendor_id){
        const vendorData = await getVendorsDao({ id: vendor_id })
        const bankVendorData = await getBankaccountDao({ user_id: vendorData.user_id });
        const result = await getPayOutVendorReportDao(bankVendorData.id, startDate, endDate, method);
        return sendSuccess(res, result, 'Payins created successfully'); 
        }else{
            const result = await getBankaccountDaoAll()
            return sendSuccess(res, result, 'Payins created successfully'); 
        }
        } catch (error) {
        console.error('error getting while fetching reports', error);
        throw new BadRequestError('Error getting while fetching reports');
    }
};



export { getPayInReportService, getPayOutReportService, getMerchantReportService, getVendorReportService };
