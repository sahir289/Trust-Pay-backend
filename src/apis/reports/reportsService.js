import { columns, merchantColumns, Role, vendorColumns } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { getMerchantReportDao, getPayInMerchantReportDao, getPayInVendorReportDao, getPayOutMerchantReportDao, getPayOutVendorReportDao } from './reportsDao.js';

const getPayInReportService = async (req) => {
    try {
        const { role } = req.user;
        const filterColumns = role === Role.MERCHANT ? merchantColumns.REPORT : role === Role.VENDOR ? vendorColumns.REPORT : columns.REPORT;

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
        const finalResult = await filterResponse(result, filterColumns);
        return finalResult;
    } catch (error) {
        console.error('error getting while fetching reports', error);
        throw new BadRequestError('Error getting while fetching reports');
    }
};
const getPayOutReportService = async (req) => {
    try {
        const { role } = req.user;
        const filterColumns = role === Role.MERCHANT ? merchantColumns.REPORT : role === Role.VENDOR ? vendorColumns.REPORT : columns.REPORT;

        const { merchant_id, vendor_id, startDate, endDate, method } = req.body;
        let result;
        if (merchant_id) {
            result = await getPayOutMerchantReportDao(merchant_id, startDate, endDate);
        }
        if (vendor_id) {
            const vendorData = await getVendorsDao({ id: vendor_id });
            const bankData = await getBankaccountDao({user_id: vendorData.user_id});
            result = await getPayOutVendorReportDao(bankData.id, startDate, endDate, method);
        }
        const finalResult = await filterResponse(result, filterColumns);
        return finalResult;
    } catch (error) {
        console.error('error getting while fetching reports', error);
        throw new BadRequestError('Error getting while fetching reports');
    }
}; const getMerchantReportService = async (req) => {
    try {
        const { role } = req.user;
        const filterColumns = role === Role.MERCHANT ? merchantColumns.REPORT : role === Role.VENDOR ? vendorColumns.REPORT : columns.REPORT;

        const { merchant_id, startDate, endDate } = req.query;

        const result = await getMerchantReportDao(merchant_id, startDate, endDate);
        const finalResult = await filterResponse(result, filterColumns);
        return finalResult;
    } catch (error) {
        console.error('error getting while fetching reports', error);
        throw new BadRequestError('Error getting while fetching reports');
    }
}; const getVendorReportService = async (req) => {
    try {
        const { role } = req.user;
        const filterColumns = role === Role.MERCHANT ? merchantColumns.REPORT : role === Role.VENDOR ? vendorColumns.REPORT : columns.REPORT;

        const { vendor_id, startDate, endDate, method } = req.query;
        const vendorData = await getVendorsDao({ id: vendor_id })
        const bankVendorData = await getBankaccountDao({ user_id: vendorData.user_id });


        const result = await getPayOutVendorReportDao(bankVendorData.id, startDate, endDate, method);
        const finalResult = await filterResponse(result, filterColumns);
        return finalResult;
    } catch (error) {
        console.error('error getting while fetching reports', error);
        throw new BadRequestError('Error getting while fetching reports');
    }
};



export { getPayInReportService, getPayOutReportService, getMerchantReportService, getVendorReportService };
