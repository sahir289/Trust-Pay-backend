import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import config from "../../config/config.js";
import { ASSIGN_PAYIN_SCHEMA, VALIDATE_PAYIN_SCHEMA } from "../../schemas/payInSchema.js";
import { CustomError, ValidationError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getMerchantBankByIdService } from "../banks/bankService.js";
import { getMerchantsService } from "../merchants/merchantService.js";
import { generatePayInUrlService, getPayInUrlService, updatePayInUrlService } from "./payInService.js";
import { Status } from "../../constants/index.js";
import { parseJSON } from "../../utils/index.js";

//  To Generate Url
export const generatePayInUrl = async (req, res) => {
    const payload = req.query;
    const joiValidation = ASSIGN_PAYIN_SCHEMA.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }

    const { code, user_id, merchant_order_id: order_id, ot, isTest, amount, returnUrl, ap } = payload;
    const merchant_order_id = order_id ? order_id : uuidv4();

    const merchantArr = await getMerchantsService({ code });
    const merchant = merchantArr[0];

    if (!merchant) {
        throw new CustomError(404, "Merchant does not exist");
    }


    if (ap && ap !== merchant.config?.api_key) {
        throw new CustomError(404, "Enter valid Api key");
    }

    if (!ap && req.headers["x-api-key"] !== merchant.config?.api_key) {
        throw new CustomError(404, "Enter valid Api key");
    }

    const bankAccountLinkRes = await getMerchantBankByIdService(merchant.user_id);
    const availableBankAccounts = bankAccountLinkRes.filter(bankAccount => bankAccount.bank_used_for === "payIn" && bankAccount.is_enabled && (bankAccount.is_bank || bankAccount.is_qr));
    if (!availableBankAccounts.length) {
        // Send alert if no bank account is linked
        throw new CustomError(404, "Bank Account has not been linked with Merchant");
    }

    const payInData = {
        code: code,
        amount,
        api_key: merchant.api_key,
        merchant_order_id,
        user_id: user_id,
        return_url: returnUrl ? returnUrl : merchant.return_url,
    };

    // Uncomment and use your service to generate PayIn URL
    const generatePayInUrlRes = await generatePayInUrlService(
        merchant,
        payInData,
        bankAccountLinkRes[0] // to add the bank_id when url is generated from api
    );

    const queryStr = isTest && (isTest === 'true' || isTest === true) ? `?t=true` : '';
    const updateRes = {
        expirationDate: generatePayInUrlRes.expirationDate,
        payInUrl: `${config.reactPaymentOrigin}/transaction/${generatePayInUrlRes.id}${queryStr}`, // use env
        payInId: generatePayInUrlRes.id,
        merchantOrderId: merchant_order_id,
    };

    if (ot === "y") {
        return sendSuccess(res, updateRes, "Payment is assigned & url is sent successfully");
    }

    res.redirect(302, updateRes.payInUrl);
    return;

}

export const validatePayInUrl = async (req, res) => {
    const { payInId } = req.params;
    const currentTime = Math.floor(Date.now() / 1000);
    const joiValidation = VALIDATE_PAYIN_SCHEMA.validate(req.params);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const payIn = await getPayInUrlService(payInId);

    if (!payIn) {
        throw new CustomError(404, "Payment Url is incorrect");
    }

    if (payIn.is_url_expires) {
        throw new CustomError(403, "Url is expired");
    }

    const config = parseJSON(payIn.config);
    if (currentTime > Number(payIn.expiration_date) && payIn.status === Status.ASSIGNED) {
        // expire payIn
        await updatePayInUrlService(payInId, {
            is_url_expires: true,
            status: Status.DROPPED,
        });
        // Notifying merchant about expired URL
        if (config.notify_url) {
            axios.post(config.notify_url, {
                status: Status.DROPPED,
                merchantOrderId: payIn.merchant_order_id,
                payinId: payIn.id,
                amount: null,
                req_amount: payIn.amount,
                utr_id: payIn.utr,
            }).catch(console.error);
        }
        throw new CustomError(403, "Session is expired");
    }

    const result = {
        code: payIn.upi_short_code,
        return_url: config.return_url,
        notify_url: config.notify_url,
        expiryTime: Number(payIn.expiration_date),
        amount: payIn.amount,
        one_time_used: payIn.one_time_used
    };

    return sendSuccess(res, result, 'Payment Url is correct');
}