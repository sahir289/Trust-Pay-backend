import { BadRequestError } from '../../utils/appErrors.js';
import { getBankaccountByIdDao, createBankaccountByIdDao, updateBankaccountByIdDao, deleteBankaccountByIdDao } from './bankaccountDao.js';





const getBankaccountByIDService = async (id) => {
    try {
        const result = await getBankaccountByIdDao(id);

        return result;
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
};
const createBankaccountByIDService = async (payload) => {
    try {

        const result = await createBankaccountByIdDao({

            user_id: payload.user_id,
            upi_id: payload.upi_id,
            upi_params: payload.upi_params,
            name: payload.name,
            ac_no: payload.ac_no,
            ac_name: payload.ac_name,
            ifsc: payload.ifsc,
            bank_name: payload.bank_name,
            is_qr: payload.is_qr,
            is_bank: payload.is_bank,
            min_payin: payload.min_payin,
            max_payin: payload.max_payin,
            is_enabled: payload.is_enabled,
            payin_count: payload.payin_count,
            balance: payload.balance,
            today_balance: payload.today_balance,
            bank_used_for: payload.bank_used_for,
            config: payload.config,
            updated_by: payload.updated_by,
            created_at: payload.created_at,
            updated_at: payload.updated_at,
            company_id: payload.company_id,
            is_obsolete: payload.is_obsolete
        });

        return result;
    } catch (error) {
        console.error('error getting while logging in', error);
        throw new BadRequestError('Error getting while logging in');
    }
};

const updateBankaccountByIDService = async (id, payload) => {
    console.log(payload, "payload")
    try {
        const result = await updateBankaccountByIdDao(id, {
            upi_id: payload.upi_id,
            upi_params: payload.upi_params,
            name: payload.name,
            ac_no: payload.ac_no,
            ac_name: payload.ac_name,
            ifsc: payload.ifsc,
            bank_name: payload.bank_name,
            is_qr: payload.is_qr,
            is_bank: payload.is_bank,
            min_payin: payload.min_payin,
            max_payin: payload.max_payin,
            is_enabled: payload.is_enabled,
            payin_count: payload.payin_count,
            balance: payload.balance,
            today_balance: payload.today_balance,
            bank_used_for: payload.bank_used_for,
            company_id: payload.company_id,
            created_at: payload.created_at,
            updated_at: payload.updated_at,


        });
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



export { getBankaccountByIDService, createBankaccountByIDService, updateBankaccountByIDService, deleteBankaccountByIDService };
