import { BadRequestError } from '../../utils/appErrors.js';
import { getBankaccountDao, createBankaccountByIdDao, updateBankaccountByIdDao, deleteBankaccountByIdDao, getMerchantBankByIdDao } from './bankaccountDao.js';

const getBankaccountService = async (payload) => {
    try {
        const result = await getBankaccountDao(payload);

        return result;
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
};

const createBankaccountByIDService = async (payload) => {
    try {

        const result = await createBankaccountByIdDao(payload);
        return result;
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
};

const updateBankaccountByIDService = async (id, payload) => {
    try {
        const result = await updateBankaccountByIdDao(id, payload);
        return result;
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
};

const deleteBankaccountByIDService = async (id) => {
    try {
        const result = await deleteBankaccountByIdDao(id, { is_obsolete: true });
        return result;
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
};

const getMerchantBankByIdService = async (id) => {
    // Fetch the bank account details for the given merchant ID
   return await getMerchantBankByIdDao(id);
}

export { getBankaccountService, createBankaccountByIDService, updateBankaccountByIDService, deleteBankaccountByIDService, getMerchantBankByIdService };
