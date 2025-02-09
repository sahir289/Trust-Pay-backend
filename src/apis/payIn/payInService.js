import { Currency, Status } from "../../constants/index.js";
import { nanoid } from 'nanoid'
import { generatePayInUrlDao, updatePayInUrlDao, validatePayInUrlDao } from "./payInDao.js";
import { getMerchantsService } from "../merchants/merchantService.js";
import axios from "axios";
import { CustomError } from "../../utils/appErrors.js";

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

export const getPayInUrlService = async (id) => {
    return await validatePayInUrlDao(id);
}

export const updatePayInUrlService = async (id, data) => {
    return await updatePayInUrlDao(id, data);
}

export const expirePayInUrlService = async (req, res) => {
    const { payInId } = req.params;
    const payIn = await getPayInUrlService(payInId);

    if (payIn?.status === Status.ASSIGNED) {
        const notifyData = {
            status: Status.DROPPED,
            merchantOrderId: payIn?.merchant_order_id,
            payinId: payIn?.id,
            amount: null,
        };
        const expireRes = await validatePayInUrlDao(payInId, notifyData);
        // axios.post(payIn?.notify_url, notifyData);
        return res.status(200).json({
            message: "Payment Url is expires",
            response: expireRes
        });
    }
}

export const assignedBankToPayInUrlService = async (req, res) => {
    const { payInId } = req.params;
    const { amount } = req.body;
    const currentTime = Math.floor(Date.now() / 1000);

    // Validate the PayIn URL
    const urlValidationRes = await getPayInUrlService(payInId);
    if (!urlValidationRes) {
        throw new CustomError(404, "Payment Url is incorrect");
    }

    if (urlValidationRes.is_url_expires || currentTime > Number(urlValidationRes.expirationDate)) {
        const payinDataRes = await getPayInUrlService(payInId);
        if (payinDataRes.status === Status.ASSIGNED) {
            const notifyData = {
                status: Status.DROPPED,
                merchantOrderId: payinDataRes.merchant_order_id,
                payinId: payinDataRes.id,
                req_amount: payinDataRes.amount,
                utr_id: payinDataRes.utr
            };
            axios.post(payinDataRes.notify_url, notifyData);
            throw new CustomError(403, "Session is expired");
        }
    }

    // Get enabled merchant bank accounts for payIn
    const getBankDetails = await getMerchantsService({ code: urlValidationRes.merchant_id });
    if (!getBankDetails.length) {
        throw new CustomError(403, `No merchant found against ${urlValidationRes.merchant_id}`);
    }
    const enabledBanks = getBankDetails?.filter((bank) => bank?.bankAccount.is_enabled && bank.bankAccount.bank_used_for === "payIn");

    if (!enabledBanks || enabledBanks.length === 0) {
        const payinDataRes = await getPayInUrlService(payInId);
        if (payinDataRes.status === Status.ASSIGNED) {
            await updatePayInUrlService(payInId, {
                is_url_expires: true,
                status: Status.DROPPED,
            });

            const notifyData = {
                status: Status.DROPPED,
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
    const convertAmount = parseFloat(amount)
    const data = {
        selectedBankDetails,
        convertAmount
    }
    const assignedBankToPayInUrlRes = await updatePayInUrlService(payInId, data);

    const payinDataResult = await validatePayInUrlDao(payInId);
    Object.assign(assignedBankToPayInUrlRes, {
        merchant_min_payin: payinDataResult.Merchant.min_payin,
        merchant_max_payin: payinDataResult.Merchant.max_payin,
        merchant_code: payinDataResult.Merchant.code,
        allow_merchant_intent: payinDataResult.Merchant.allow_intent,
        sno: payinDataResult.sno
    });

    return res.status(201).json({
        message: "Bank account is assigned",
        data: assignedBankToPayInUrlRes
    });
}

export const checkPayInStatusService = async (req, res) => {
    const { payinId, merchantCode } = req.body;

    const getMerchantApiKeyByCode = await getMerchantsService({ merchantCode });
    if (!getMerchantApiKeyByCode) {
        throw new CustomError(404, "Merchant does not exist");
    }

    const data = await getPayInUrlService(payinId);
    if (!data) {
        return res.status(404).json({
            status: "error",
            error: "payin not found",
        });
    }
    const response = {
        status: data.status,
        merchantOrderId: data.merchant_order_id,
        amount: data.amount,
        payinId: data.id,
    };

    return res.status(200).json({
        message: "PayIn status fetched successfully",
        response,
    });
}