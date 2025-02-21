import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { getMerchantReportDao, getPayInMerchantReportDao, getPayInVendorReportDao, getPayOutMerchantReportDao, getPayOutVendorReportDao } from './reportsDao.js';





const getPayInReportService = async (req, res) => {
    try {
        const { merchant_id, vendor_id , startDate, endDate , method   } = req.body;
        let result;
        if (merchant_id) {
            result = await getPayInMerchantReportDao(merchant_id, startDate, endDate );
        }
        if (vendor_id) {
            const vendorData = await getVendorsDao({id: vendor_id})
            const bankVendorData = await getBankaccountDao({user_id :  vendorData.user_id}   );
            result = await getPayInVendorReportDao(bankVendorData.id, startDate, endDate , method );
            console.log(result.rows, "ujytgfgdcvbn")
        }
        return sendSuccess(res, result, 'getUsers successfully');

    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
};
const getPayOutReportService = async (req, res) => {
    try {
        const { merchant_id, vendor_id , startDate, endDate , method   } = req.body;
        let result;
        if (merchant_id) {
            result = await getPayOutMerchantReportDao(merchant_id , startDate, endDate);
        }
        if (vendor_id) {
            const vendorData = await getBankaccountDao(vendor_id);
            const bankData = await getVendorsDao({ searchString: vendorData.user_id });
            result = await getPayOutVendorReportDao(bankData.id , startDate, endDate , method  );
        }
        return sendSuccess(res, result, 'getUsers successfully');
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
}; const getMerchantReportService = async (req, res) => {
    try {
        const { merchant_id , startDate, endDate } = req.query;

        const result = await getMerchantReportDao(merchant_id, startDate, endDate);
        return sendSuccess(res, result, 'getUsers successfully');
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
}; const getVendorReportService = async (req, res) => {
    try {
        const { vendor_id, startDate, endDate , method  } = req.query;
        const vendorData = await getVendorsDao({id: vendor_id})
        const bankVendorData = await getBankaccountDao({user_id :  vendorData.user_id}   );

       
        const result = await getPayOutVendorReportDao(bankVendorData.id,  startDate, endDate , method );        
        return sendSuccess(res, result, 'getUsers successfully');
        
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
};



export { getPayInReportService, getPayOutReportService, getMerchantReportService, getVendorReportService };
