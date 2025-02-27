import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { getMerchantReportDao, getPayinReportDao, getPayInMerchantReportDao, getPayInVendorReportDao, getPayOutMerchantReportDao, getPayOutVendorReportDao, getVendorReportDao, getPayOutAll } from './reportsDao.js';

const getPayInReportService = async (req, res) => {
    try {
        const { company_id } = req.user
        const { merchant_id, vendor_id, startDate, endDate, method } = req.body;
        let result;
        if (merchant_id) {
            result = await getPayInMerchantReportDao(merchant_id, startDate, endDate, company_id);
        }
        if (vendor_id) {
            const vendorData = await getVendorsDao({ id: vendor_id })
            const bankVendorData = await getBankaccountDao({ user_id: vendorData.user_id });
            result = await getPayInVendorReportDao(bankVendorData.id, startDate, endDate, method, company_id);
        }
        else {
        result = await getPayinReportDao({ company_id: company_id });

        }
        return sendSuccess(res, result, "got payin report")
    } catch (error) {
        console.error('error getting while fetching reports', error);
        throw new BadRequestError('Error getting while fetching reports');
    }
};
const getPayOutReportService = async (req, res) => {
    try {
        const { company_id } = req.user
        const { merchant_id, vendor_id, startDate, endDate, method } = req.body;
        let result;
        if (merchant_id) {
            result = await getPayOutMerchantReportDao(merchant_id, startDate, endDate, company_id);
            return sendSuccess(res, result, 'Payouts created successfully');
        }
        if (vendor_id) {
            const vendorData = await getVendorsDao({ id: vendor_id });
            const bankData = await getBankaccountDao({ user_id: vendorData.user_id });
            result = await getPayOutVendorReportDao(bankData.id, startDate, endDate, method, company_id);
            return sendSuccess(res, result, 'Payouts created successfully');
        }
        else {
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
        const { company_id } = req.user
        const { merchant_id, startDate, endDate } = req.query;
        if (merchant_id && startDate && endDate) {
            const result = await getMerchantReportDao(merchant_id, startDate, endDate, company_id);
            return sendSuccess(res, result, 'Reports fetched successfully');
        }
        else {
            const result = await getPayinReportDao({ company_id: company_id })
            return sendSuccess(res, result, 'Reports created successfully');
        }

    } catch (error) {
        console.error('error getting while fetching reports', error);
        throw new BadRequestError('Error getting while fetching reports');
    }
}


const getVendorReportService = async (req, res) => {
    try {
        const { company_id } = req.user
        const { vendor_id, startDate, endDate, method } = req.query;
        if (vendor_id) {
            const vendorData = await getVendorsDao({ id: vendor_id })
            const bankVendorData = await getBankaccountDao({ user_id: vendorData.user_id });
            const result = await getVendorReportDao(bankVendorData.id, startDate, endDate, method , company_id);
            return sendSuccess(res, result, 'Reports created successfully');
        } else {
            const result = await getPayOutAll({ company_id: company_id })
            return sendSuccess(res, result, 'Reports created successfully');
        }
    } catch (error) {
        console.error('error getting while fetching reports', error);
        throw new BadRequestError('Error getting while fetching reports');
    }
};



export { getPayInReportService, getPayOutReportService, getMerchantReportService, getVendorReportService };
