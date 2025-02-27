import { columns, merchantColumns, Role, vendorColumns } from '../../constants/index.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { getBankaccountDao, createBankaccountDao, updateBankaccountDao, deleteBankaccountDao } from './bankaccountDao.js';

const getBankaccountService = async (filters, role) => {
    try {
        const filterColumns = role === Role.MERCHANT ? merchantColumns.BANK_ACCOUNT : role=== Role.VENDOR ? vendorColumns.BANK_ACCOUNT : columns.BANK_ACCOUNT;
        return await getBankaccountDao(filters, null, null, null, null, filterColumns);
    } catch (error) {
        console.error('error getting while  getting banks', error);
        throw new BadRequestError('Error getting while  getting banks');
    }
};
const createBankaccountService = async (payload) => {
    try {
        const result = await createBankaccountDao(payload);
        return result;
    } catch (error) {
        console.error('error getting while  creating banks', error);
        throw new BadRequestError('Error getting while  creating banks');
    }
};

const updateBankaccountService = async (conn, ids, payload) => {
    try {
        const result = await updateBankaccountDao(conn, {id: ids.id, company_id: ids.company_id },payload);
        return result;
    } catch (error) {
        console.error('error getting while  updating banks', error);
        throw new BadRequestError('Error getting while  updating banks');
    }
};

const deleteBankaccountService = async (conn, ids) => {
    try {
        const payload = { is_obsolete: true }
        const result = await deleteBankaccountDao(conn, {id: ids.id, company_id: ids.company_id },payload);
        return result;
    } catch (error) {
        console.error('error getting while deleting banks', error);
        throw new BadRequestError('Error getting while  deleting banks');
    }
};



export { getBankaccountService, createBankaccountService, updateBankaccountService, deleteBankaccountService };
