import { BANK_ACCOUNT_SCHEMA, UPDATE_BANK_ACCOUNT_SCHEMA, VALIDATE_BANK_RESPONSE_BY_ID } from '../../schemas/bankAccoountSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { getBankaccountDao, createBankaccountDao, updateBankaccountDao, deleteBankaccountDao } from './bankaccountDao.js';

const getBankaccountService = async (payload) => {
    try {
        const joiValidation = VALIDATE_BANK_RESPONSE_BY_ID.validate(payload);
        if (joiValidation.error) {
            throw new ValidationError(joiValidation.error);
        }
        const result = await getBankaccountDao(payload);
        return result;
    } catch (error) {
        console.error('error getting while  getting banks', error);
        throw new BadRequestError('Error getting while  getting banks');
    }
};

const createBankaccountService = async (payload) => {
    try {
        
        const joiValidation = BANK_ACCOUNT_SCHEMA.validate(payload);
        if (joiValidation.error) {
            throw new ValidationError(joiValidation.error);
        }
        const result = await createBankaccountDao(payload);
        return result;
    } catch (error) {
        console.error('error getting while  creating banks', error);
        throw new BadRequestError('Error getting while  creating banks');
    }
};

const updateBankaccountService = async (id, payload) => {
    try {
        const joiValidation = UPDATE_BANK_ACCOUNT_SCHEMA.validate(payload);
        if (joiValidation.error) {
            throw new ValidationError(joiValidation.error);
        }
        const result = await updateBankaccountDao(id, payload);
        return result;
    } catch (error) {
        console.error('error getting while  updating banks', error);
        throw new BadRequestError('Error getting while  updating banks');
    }
};

const deleteBankaccountService = async (id) => {
    try {
        const result = await deleteBankaccountDao(id, { is_obsolete: true });
        return result;
    } catch (error) {
        console.error('error getting while deleting banks', error);
        throw new BadRequestError('Error getting while  deleting banks');
    }
};



export { getBankaccountService, createBankaccountService, updateBankaccountService, deleteBankaccountService };
