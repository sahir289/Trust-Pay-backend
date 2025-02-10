import { getMerchantBankByIdDao } from "./bankDao.js";

export const getMerchantBankByIdService = async (id) => {
    // Fetch the bank account details for the given merchant ID
   return await getMerchantBankByIdDao(id);
}