import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { getMerchantReportDao, getPayInMerchantReportDao, getPayInVendorReportDao, getPayOutMerchantReportDao, getPayOutVendorReportDao, getVendorReportDao } from './reportsDao.js';





const getPayInReportService = async (req, res) => {
    try {
        const { merchant_id, vendor_id } = req.body;
        let result;
        if (merchant_id) {
            result = await getPayInMerchantReportDao(merchant_id);
        }
        if (vendor_id) {
            const vendorData = await getBankaccountDao(vendor_id);
            const bankData = await getVendorsDao({ searchString: vendorData.user_id });
            result = await getPayInVendorReportDao(bankData.id);
        }
        return sendSuccess(res, result, 'getUsers successfully');

    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
};
const getPayOutReportService = async (req, res) => {
    try {
        const { merchant_id, vendor_id } = req.body;
        let result;
        if (merchant_id) {
            result = await getPayOutMerchantReportDao(merchant_id);
        }
        if (vendor_id) {
            const vendorData = await getBankaccountDao(vendor_id);
            const bankData = await getVendorsDao({ searchString: vendorData.user_id });
            result = await getPayOutVendorReportDao(bankData.id);
        }
        return sendSuccess(res, result, 'getUsers successfully');
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
}; const getMerchantReportService = async (req, res) => {
    try {
        const { id } = req.query;

        const result = await getMerchantReportDao(id);
        return sendSuccess(res, result, 'getUsers successfully');
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
}; const getVendorReportService = async (req, res) => {
    try {
        const { vendor_id } = req.query;
        const vendorData = await getBankaccountDao(vendor_id);
        const bankData = await getVendorsDao({ searchString: vendorData.user_id });
        const result = await getPayOutVendorReportDao(bankData.id);        
        return sendSuccess(res, result, 'getUsers successfully');
        
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
};



export { getPayInReportService, getPayOutReportService, getMerchantReportService, getVendorReportService };
