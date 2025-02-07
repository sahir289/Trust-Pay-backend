import { Currency, Status } from "../../constants/index.js";
import { nanoid } from 'nanoid'
import { generatePayInUrlDao, updatePayInUrlDao, validatePayInUrlDao } from "./payInDao.js";

export const generatePayInUrlService = async (merchant, payInData = {}, bank) => {
    const _10_MINUTES = 1000 * 60 * 10;
    const expirationDate = Math.floor(
        (new Date().getTime() + _10_MINUTES) / 1000
    );

    const data = {
        upi_short_code: nanoid(5), // code added by us
        amount: payInData.amount || 0, // as starting amount will be zero
        status: Status.INITIATED,
        currency: Currency.INR,
        merchant_order_id: payInData.merchant_order_id, // for time being we are using this
        user: payInData.user_id,
        merchant_id: merchant.id,
        expiration_date: expirationDate,
        bank_acc_id: bank.id, // in old if amount is available only then it can be added
        company_id: merchant.company_id,
        config: JSON.stringify({
            return_url: payInData.return_url || '',
            notify_url: merchant.notify_url || '',
        })
    };

    return await generatePayInUrlDao(data);
}

export const getPayInUrlService = async (id)=>{
    return await validatePayInUrlDao(id);   
}

export const updatePayInUrlService = async (id, data)=>{
    return await updatePayInUrlDao(id, data);
}