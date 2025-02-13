import { BadRequestError } from '../../utils/appErrors.js';
import { getBankaccountDao, createBankaccountDao, updateBankaccountDao, deleteBankaccountDao, getMerchantBankDao } from './bankaccountDao.js';

const getBankaccountService = async (payload) => {
    try {
        const result = await getBankaccountDao(payload);

        return result;
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
};

const createBankaccountService = async (payload) => {
    try {

        const result = await createBankaccountDao(payload);
        return result;
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
};

const updateBankaccountService = async (id, payload) => {
    try {
        const result = await updateBankaccountDao(id, payload);
        return result;
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
};

const deleteBankaccountService = async (id) => {
    try {
        const result = await deleteBankaccountDao(id, { is_obsolete: true });
        return result;
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
};

const getMerchantBankService = async (id) => {
    // Fetch the bank account details for the given merchant ID
   return await getMerchantBankDao(id);
}

export { getBankaccountService, createBankaccountService, updateBankaccountService, deleteBankaccountService, getMerchantBankService };
