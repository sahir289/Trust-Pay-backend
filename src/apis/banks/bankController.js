import { sendSuccess } from "../../utils/responseHandlers.js";
import { getMerchantBankByIdService } from "./bankService.js";

export const getMerchantBankById = async (req, res) => {
    // Fetch the bank account details for the given merchant ID
    const bankRes = await getMerchantBankByIdService(req.params.id);
    return sendSuccess(res, bankRes, 'Bank details fetched successfully');
}