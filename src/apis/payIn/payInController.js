import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import config from "../../config/config.js";
import { ASSIGN_PAYIN_SCHEMA, VALIDATE_ASSIGNED_BANT_TO_PAY, VALIDATE_CHECK_PAY_IN_STATUS, VALIDATE_EXPIRE_PAY_IN_URL, VALIDATE_PAYIN_SCHEMA } from "../../schemas/payInSchema.js";
import { CustomError, ValidationError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getMerchantBankByIdService } from "../banks/bankService.js";
import { getMerchantsService } from "../merchants/merchantService.js";
import { assignedBankToPayInUrlService, checkPayInStatusService, expirePayInUrlService, generatePayInUrlService, getMerchantByCodeService, getPayInDataService, getPayInUrlService, updatePayInUrlService } from "./payInService.js";
import { Status } from "../../constants/index.js";
import { getPayInDataDao, validatePayInUrlDao } from "./payInDao.js";

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

    const config = payIn.config || {};
    // TODO: modify expiration date type 
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
        one_time_used: payIn.one_time_used,
        status: payIn.status,
    };

    return sendSuccess(res, result, 'Payment Url is correct');
}

export const assignedBankToPayInUrl = async (req, res) => {
    const payload = req.query;
    const joiValidation = VALIDATE_ASSIGNED_BANT_TO_PAY.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }

    const { payInId } = req.params;
    const { amount } = req.body;
    const currentTime = Math.floor(Date.now() / 1000);

    // Validate the PayIn URL
    const urlValidationRes = await validatePayInUrlDao(payInId);
    if (!urlValidationRes) {
        throw new CustomError(404, "Payment Url is incorrect");
    }

    if (urlValidationRes.is_url_expires || currentTime > Number(urlValidationRes.expirationDate)) {
        const payinDataRes = await getPayInDataService(payInId);
        if (payinDataRes.status === "ASSIGNED") {
            const notifyData = {
                status: "DROPPED",
                merchantOrderId: payinDataRes.merchant_order_id,
                payinId: payinDataRes.id,
                req_amount: payinDataRes.amount,
                utr_id: payinDataRes.utr
            };
            await axios.post(payinDataRes.notify_url, notifyData);
            throw new CustomError(403, "Session is expired");
        }
    }

    // Get enabled merchant bank accounts for payIn
    const getBankDetails = await getMerchantBankByIdService(urlValidationRes.merchant_id);
    const enabledBanks = getBankDetails?.filter((bank) => bank?.bankAccount?.is_enabled && bank?.bankAccount?.bank_used_for === "payIn");

    if (!enabledBanks || enabledBanks.length === 0) {
        const payinDataRes = await getPayInDataService(payInId);
        if (payinDataRes.status === "ASSIGNED") {
            await expirePayInUrlService(payInId);

            const notifyData = {
                status: "DROPPED",
                merchantOrderId: payinDataRes.merchant_order_id,
                payinId: payinDataRes.id,
                req_amount: payinDataRes.amount,
                utr_id: payinDataRes.utr
            };
            await axios.post(payinDataRes.notify_url, notifyData);
            throw new CustomError(404, "No enabled bank account found");
        }
    }

    // Randomly assign one enabled bank account
    const selectedBankDetails = enabledBanks[Math.floor(Math.random() * enabledBanks.length)];
    const assignedBankToPayInUrlRes = await assignedBankToPayInUrlService(payInId, selectedBankDetails, parseFloat(amount));

    const payinDataResult = await getPayInDataDao(payInId);
    Object.assign(assignedBankToPayInUrlRes, {
        merchant_min_payin: payinDataResult.Merchant.min_payin,
        merchant_max_payin: payinDataResult.Merchant.max_payin,
        merchant_code: payinDataResult.Merchant.code,
        allow_merchant_intent: payinDataResult.Merchant.allow_intent,
        sno: payinDataResult.sno
    });

    res.status(201).json({
        message: "Bank account is assigned",
        data: assignedBankToPayInUrlRes
    });
};

export const expirePayInUrl = async (req, res) => {
    const joiValidation = VALIDATE_EXPIRE_PAY_IN_URL.validate(req.params);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const { payInId } = req.params;
    const payinDataRes = await getPayInDataService(payInId)
    if (payinDataRes?.status === "ASSIGNED") {
        const expireRes = await expirePayInUrlService(payInId);
        console.log('============>', expireRes);
        // const expirePayinUrl = 
        // const notifyData = {
        //     status: "DROPPED",
        //     merchantOrderId: payinDataRes?.merchant_order_id,
        //     payinId: payinDataRes?.id,
        //     amount: null,
        //     req_amount: payinDataRes?.amount,
        //     utr_id: payinDataRes?.utr
        // };
        // const notifyMerchant = await axios.post(payinDataRes?.notify_url, notifyData);
        // logger.info('Notification sent successfully', {
        //     status: notifyMerchant.status,
        //     data: notifyMerchant.data,
        // });
        res.status(200).json({
            message: "Payment Url is expires",
        });
    }
}

export const checkPayInStatus = async (req, res) => {
    const joiValidation = VALIDATE_CHECK_PAY_IN_STATUS.validate(req.body);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const { payinId, merchantCode, merchantOrderId } = req.body;

    const getMerchantApiKeyByCode = await getMerchantByCodeService(
        merchantCode
    );
    if (!getMerchantApiKeyByCode) {
        throw new CustomError(404, "Merchant does not exist");
    }

    const apiKey = req.headers["x-api-key"];
    if (apiKey !== merchant.api_key && apiKey !== merchant.public_api_key) {
        throw new CustomError(404, "Enter valid API key");
    }
    if (!merchantCode) {
        return res.status(404).json({
            status: "error",
            error: "API key / code not found"
        });
    }

    const data = await checkPayInStatusService(
        payinId,
        merchantCode,
        merchantOrderId
    );
    if (!data) {
        return res.status(404).json({
            status: "error",
            error: "payin not found",
        });
    }
    const response = {
        status: data.status,
        merchantOrderId: data.merchant_order_id,
        amount: data.confirmed,
        payinId: data.id,
        req_amount: data?.amount,
        utr_id: (data.status === "SUCCESS" || data.status === "DISPUTE") ? data?.utr : " "
    };

    return res.status(200).json({
        res,
        message: "PayIn status fetched successfully",
        response,
    });
}
