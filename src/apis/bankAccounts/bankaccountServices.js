import { BadRequestError } from '../../utils/appErrors.js';
import { getBankaccountDao, createBankaccountDao, updateBankaccountDao, deleteBankaccountDao } from './bankaccountDao.js';

const getBankaccountService = async (filters) => {
    try {
        const result = await getBankaccountDao(filters);
        return result;
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

const updateBankaccountService = async (id, payload) => {
    try {
        const result = await updateBankaccountDao(id,payload);
        return result;
    } catch (error) {
        console.error('error getting while  updating banks', error);
        throw new BadRequestError('Error getting while  updating banks');
    }
};

const deleteBankaccountService = async (id) => {
    try {
        const result = await deleteBankaccountDao(id,{ is_obsolete: true });
        return result;
    } catch (error) {
        console.error('error getting while deleting banks', error);
        throw new BadRequestError('Error getting while  deleting banks');
    }
};



export { getBankaccountService, createBankaccountService, updateBankaccountService, deleteBankaccountService };
