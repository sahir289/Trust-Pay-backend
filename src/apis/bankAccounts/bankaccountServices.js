import { columns, Role, vendorColumns } from '../../constants/index.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { getBankaccountDao, createBankaccountDao, updateBankaccountDao, deleteBankaccountDao } from './bankaccountDao.js';

const getBankaccountService = async (filters, role) => {
    try {
        const result = await getBankaccountDao(filters);
        const filterColumns = role ===  Role.VENDOR ? vendorColumns.BANK_ACCOUNT : columns.BANK_ACCOUNT;
        return await filterResponse(result, filterColumns);
    } catch (error) {
        console.error('error getting while  getting banks', error);
        throw new BadRequestError('Error getting while  getting banks');
    }
};
const createBankaccountService = async (payload,role) => {
    try {
        const filterColumns = role ===  Role.VENDOR ? vendorColumns.BANK_ACCOUNT : columns.BANK_ACCOUNT;
        const result = await createBankaccountDao(payload);
        const finalResult = await filterResponse(result, filterColumns);
        return finalResult;
    } catch (error) {
        console.error('error getting while  creating banks', error);
        throw new BadRequestError('Error getting while  creating banks');
    }
};

const updateBankaccountService = async (id, payload,role) => {
    try {
        const filterColumns = role ===  Role.VENDOR ? vendorColumns.BANK_ACCOUNT : columns.BANK_ACCOUNT;
        const result = await updateBankaccountDao(id,payload);
        const finalResult = await filterResponse(result, filterColumns);
        return finalResult;
    } catch (error) {
        console.error('error getting while  updating banks', error);
        throw new BadRequestError('Error getting while  updating banks');
    }
};

const deleteBankaccountService = async (id,role) => {
    try {
        const filterColumns = role ===  Role.VENDOR ? vendorColumns.BANK_ACCOUNT : columns.BANK_ACCOUNT;
        const result = await deleteBankaccountDao(id,{ is_obsolete: true });
        const finalResult = await filterResponse(result, filterColumns);
        return finalResult;
    } catch (error) {
        console.error('error getting while deleting banks', error);
        throw new BadRequestError('Error getting while  deleting banks');
    }
};



export { getBankaccountService,getMerchantBankService, createBankaccountService, updateBankaccountService, deleteBankaccountService };
