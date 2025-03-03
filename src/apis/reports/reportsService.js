import { columns, merchantColumns, Role, vendorColumns } from '../../constants/index.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
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
        const { company_id, role } = req.user
        const filterColumns = role === Role.MERCHANT ? merchantColumns.CALCULATION : columns.CALCULATION;
        const { code, startDate, endDate } = req.query;
        ///api/data?code=123&code=456&startDate=2024-01-01&endDate=2024-01-31
        let dataArray = []
        if (code) {
            const merchantDatas = await getMerchantsDao({ code: code })
            for (let merchantData of merchantDatas) {
                const result = await getMerchantReportDao({ user_id: merchantData.user_id, company_id: company_id }, startDate, endDate, null, null, null, null, filterColumns);
                dataArray.push(...result)
            } return sendSuccess(res, dataArray, 'Reports fetched successfully');
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
        const { company_id, role } = req.user
        const filterColumns = role === Role.VENDOR ? vendorColumns.CALCULATION : columns.CALCULATION;
        const { code, startDate, endDate } = req.query;
        ///api/data?code=123&code=456&startDate=2024-01-01&endDate=2024-01-31
        let dataArray = []
        if (code) {
            const vendorDatas = await getVendorsDao({ code: code })
            for (let vendorData of vendorDatas) {
                const result = await getVendorReportDao({ user_id: vendorData.user_id, company_id: company_id }, startDate, endDate, null, null, null, null, filterColumns);
                dataArray.push(...result)
            } return sendSuccess(res, dataArray, 'Reports fetched successfully');
        }
        else {
            const result = await getPayinReportDao({ company_id: company_id })
            return sendSuccess(res, result, 'Reports created successfully');
        }
    } catch (error) {
        console.error('error getting while fetching reports', error);
        throw new BadRequestError('Error getting while fetching reports');
    }
};



export { getPayInReportService, getPayOutReportService, getMerchantReportService, getVendorReportService };
