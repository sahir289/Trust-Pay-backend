import axios from "axios";
import { nanoid } from 'nanoid'
import { Currency, Status, Type } from "../../constants/index.js";
import { generatePayInUrlDao, updatePayInUrlDao, getPayInUrlDao } from "./payInDao.js";
import { getMerchantsService } from "../merchants/merchantService.js";
import { AccessDeniedError, BadRequestError, NotFoundError } from "../../utils/appErrors.js";
import { v4 as uuidv4 } from "uuid";
import { getMerchantBankByIdService } from "../banks/bankService.js";
import { getMerchantBankByIdDao } from "../banks/bankDao.js";
import { razorpay } from "../../webhooks/razorPay.js";
import config from "../../config/config.js";
import { Cashfree } from "cashfree-pg";
import { getWithdrawByIdService } from "../withdraw/withDrawService.js";
import { calculateCommission } from "../../utils/utils.js";

Cashfree.XClientId = config.cashFreeClientId;
Cashfree.XClientSecret = config.XClientSecret;
Cashfree.XEnvironment = Cashfree.Environment.PRODUCTION

export const generatePayInUrlService = async (payload) => {
    const { code, user_id, merchant_order_id: order_id, amount, returnUrl, api_key, x_api_key } = payload;
    const merchant_order_id = order_id ? order_id : uuidv4();

    const merchantArr = await getMerchantsService({ code });
    const merchant = merchantArr[0];

    if (!merchant) {
        throw new NotFoundError("Merchant does not exist");
    }

    if (api_key && api_key != merchant.config?.api_key) {
        throw new BadRequestError("Enter valid Api key");
    }

    if (!api_key && x_api_key != merchant.config?.api_key) {
        throw new BadRequestError(404, "Enter valid Api key");
    }

    const bankAccountLinkRes = await getMerchantBankByIdService(merchant.user_id);
    const availableBankAccounts = bankAccountLinkRes.filter(bankAccount => bankAccount.bank_used_for === "payIn" && bankAccount.is_enabled && (bankAccount.is_bank || bankAccount.is_qr));
    if (!availableBankAccounts.length) {
        // Send alert if no bank account is linked
        throw new BadRequestError("Bank Account has not been linked with Merchant");
    }

    const payInData = {
        code: code,
        amount,
        api_key: merchant.api_key,
        merchant_order_id,
        user_id: user_id,
        return_url: returnUrl ? returnUrl : merchant.return_url,
    };

    const _10_MINUTES = 1000 * 60 * 10;
    const expirationDate = Math.floor((new Date().getTime() + _10_MINUTES) / 1000);
    const bank = bankAccountLinkRes[Math.floor(Math.random() * bankAccountLinkRes.length)];
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

    const currentTime = Math.floor(Date.now() / 1000);
    const payIn = await getPayInUrlDao({ id });

    if (!payIn) {
        throw new NotFoundError("Payment Url is incorrect");
    }

    if (payIn.is_url_expires) {
        throw new AccessDeniedError("Url is expired");
    }

    const config = payIn.config || {};
    // TODO: modify expiration date type 
    if (currentTime > Number(payIn.expiration_date) && payIn.status !== Status.INITIATED) {
        // expire payIn
        await updatePayInUrlDao(id, {
            is_url_expires: true,
            status: Status.DROPPED,
        });
        // Notifying merchant about expired URL
        notifyMerchants(config.notify_url, {
            status: Status.DROPPED,
            merchantOrderId: payIn.merchant_order_id,
            payinId: payIn.id,
            amount: null,
            req_amount: payIn.amount,
            utr_id: payIn.utr,
        })
        throw new AccessDeniedError("Session is expired");
    }

    return payIn;
}


// TODO: delete this API
export const expirePayInUrlService = async (payInId) => {
    const currentTime = Math.floor(Date.now() / 1000);
    const payIn = await getPayInUrlDao({ id: payInId });
    if (!payIn) {
        throw new NotFoundError('PayIn not found!');
    }

    // Question
    // isn't cron job will be best fit to expire payIns with time
    // if (payIn.status !== Status.ASSIGNED) {
    // throw new BadRequestError('PayIn is not assigned');
    // }
    if (currentTime < Number(payIn.expiration_date)) {
        throw new BadRequestError('Pay In is not expired yet!');
    }

    const config = payIn.config || {};
    await updatePayInUrlDao(payInId, {
        is_url_expires: true,
        status: Status.DROPPED,
    })

    notifyMerchants(config.notify_url, {
        status: Status.DROPPED,
        merchantOrderId: payIn.merchant_order_id,
        payinId: payIn.id,
        amount: null,
        req_amount: payIn.amount,
        utr_id: payIn.utr
    });
}

export const assignedBankToPayInUrlService = async (payInId, amount) => {

    // Validate the PayIn URL
    const payIn = await getPayInUrlService(payInId);
    const payInConfig = payIn.config || {};

    // TODO: should we check other statuses too?
    if (payIn.status !== Status.INITIATED) {
        throw new BadRequestError('PayIn has been confirmed already!');
    }

    const merchantArr = await getMerchantsService({ id: payIn.merchant_id });
    const merchant = merchantArr[0] || {};

    if (!merchant) {
        throw new NotFoundError('No merchant found');
    }

    // Get enabled merchant bank accounts for payIn
    // Todo: Assign bank on the basis type
    // type maybe UPI, PhonePe, Bank Transfer
    // allow_qr ==> UPI
    // config.is_phonpe ==> Phone Pe
    // is_enabled ==> Bank Transfer
    const banks = await getMerchantBankByIdDao(merchant.user_id);
    const enabledBanks = banks.filter((bank) => bank.is_enabled && bank.bank_used_for === "payIn")
    if (!enabledBanks.length) {
        await updatePayInUrlDao(payInId, {
            is_url_expires: true,
            status: Status.DROPPED,
        });
        notifyMerchants(payInConfig.notify_url, {
            status: Status.DROPPED,
            merchantOrderId: payIn.merchant_order_id,
            payinId: payIn.id,
            req_amount: payIn.amount,
            utr_id: payIn.utr
        })
        throw new NotFoundError(`No enabled bank found!`);
    }
    // Randomly assign one enabled bank account
    const selectedBankDetails = enabledBanks[Math.floor(Math.random() * enabledBanks.length)];
    const updatePayIn = await updatePayInUrlDao(payInId, {
        amount: parseFloat(amount),
        status: Status.ASSIGNED,
        bank_acc_id: selectedBankDetails.id,
    })

    Object.assign(updatePayIn, {
        merchant_min_payin: merchant.min_payin,
        merchant_max_payin: merchant.max_payin,
        merchant_code: merchant.code,
        allow_merchant_intent: merchant.allow_intent,
        code: updatePayIn.upi_short_code,
        bank: selectedBankDetails,
    });

    return updatePayIn;
}

// Public API Used by Merchants
export const checkPayInStatusService = async (payInId, merchantCode, merchantOrderId, api_key) => {

    // query on the bases of:
    // merchant table code column
    // payin table id and merchant_order_id
    const merchantArr = await getMerchantsService({ code: merchantCode });
    const merchant = merchantArr[0];
    if (!merchant) {
        throw new NotFoundError("Merchant does not exist");
    }

    const merchantConfig = merchant.config || {};
    const payIn = await getPayInUrlDao({
        id: payInId,
        merchant_order_id: merchantOrderId,
    });
    if (!payIn) {
        throw new NotFoundError('payIn not found');
    }

    if (api_key != merchantConfig.api_key) {
        throw new BadRequestError('Invalid PayIn!');
    }

    return {
        status: payIn.status,
        merchantOrderId: payIn.merchant_order_id,
        amount: payIn.amount,
        payinId: payIn.id,
    };
}

export const payInIntentGenerateOrderService = async (payInId, amount, isRazorpay) => {
    const getPayInData = await getPayInUrlService(payInId);
    if (!getPayInData) {
        throw new NotFoundError(404, "Payment does not exist");
    }
    if (isRazorpay) {
        const orderRes = await razorpay.orders.create({
            amount: amount * 100,
            currency: "INR",
            receipt: payInId,
        });

        return {
            status: orderRes.status
        };
    }

    const requestBody = {
        "order_amount": amount,
        "order_currency": "INR",
        "customer_details": {
            "customer_id": "node_sdk_test",
            "customer_email": "example@gmail.com",
            "customer_phone": "9999999999"
        },
        "order_meta": {
            "return_url": "https://test.cashfree.com/pgappsdemos/return.php?order_id={order_id}",
            "paymentMethod": "upi",

        }
    }

    const cashFreeResponse = await Cashfree.PGCreateOrder(payInId, requestBody)
        .catch(err => {
            const data = err?.response?.data || {};
            console.error(data);
            throw new Error("Error while creating CashFree Order")
        })


    return {
        payment_amount: amount,
        cashFreeResponse,
        payInId,
    };
};

export const updatePaymentNotificationStatusService = async (payInId, type) => {
    let updatePayInOutRes;
    let notifyData;
    let notifyUrl;

    if (type === Type.PAYIN) {
        updatePayInOutRes = await updatePayInUrlDao(payInId, { is_notified: true });
        if (!updatePayInOutRes) {
            throw new Error("Payin data not found.");
        }
        notifyData = {
            status: updatePayInOutRes.status,
            merchantOrderId: updatePayInOutRes.merchant_order_id,
            payinId: updatePayInOutRes.id,
            amount: updatePayInOutRes.confirmed,
            utr_id: updatePayInOutRes.utr || "",
        };
        notifyUrl = updatePayInOutRes.notify_url;
    } else if (type === Type.PAYOUT) {
        updatePayInOutRes = await getWithdrawByIdService(id);

        if (!updatePayInOutRes) {
            throw new Error("Payout data not found.");
        }

        const merchant = await getMerchantBankByIdDao(updatePayInOutRes.merchant_id);

        if (!merchant || !merchant.payout_notify_url) {
            throw new Error("Merchant or payout notify URL not found.");
        }

        notifyData = {
            code: updatePayInOutRes.code,
            merchantOrderId: updatePayInOutRes.merchant_order_id,
            payoutId: updatePayInOutRes.id,
            amount: updatePayInOutRes.amount,
            status: updatePayInOutRes.status,
            utr_id: updatePayInOutRes.utr_id || "",
        };
        notifyUrl = merchant.payout_notify_url;
    } else {
        throw new Error("Invalid notification type.");
    }

    const response = notifyMerchants(notifyUrl, notifyData)
    return {
        response
    };
}

//under development..
export const updateDepositStatusService = async (merchantId, bank_name) => {
    const payInData = await getPayInUrlService(merchantId);

    if (!payInData) {
        throw Error("PayIn data not found")
    }
    if (payInData.status !== "BANK_MISMATCH") {
        throw Error("Status is not BANK_MISMATCH, no update applied")
    }
    //call the telegram API
    const getBankResponseByUtr = await botResponseRepo.getBotResByUtr(
        payInData?.utr
    );

    const payinCommission = calculateCommission(
        getBankResponseByUtr?.amount,
        payInData?.Merchant?.payin_commission
    );

    const durMs = new Date() - payInData?.createdAt;
    const durSeconds = Math.floor((durMs / 1000) % 60).toString().padStart(2, '0');
    const durMinutes = Math.floor((durSeconds / 60) % 60).toString().padStart(2, '0');
    const durHours = Math.floor((durMinutes / 60) % 24).toString().padStart(2, '0');
    const duration = `${durHours}:${durMinutes}:${durSeconds}`;

    //get bank by nick name api under construction..
    const getBank = await bankAccountRepo.getBankNickName(bank_name);

    let getSuccessData
    if (getBankResponseByUtr.is_used) {
        let existingPayinData;
        existingPayinData = await payInRepo.getPayinDataByUtr(getBankResponseByUtr?.utr);
        if (existingPayinData.length === 0) {
            existingPayinData = await payInRepo.getPayinDataByUsrSubmittedUtr(getBankResponseByUtr?.utr);
        }
        if (existingPayinData.length > 1) {
            getSuccessData = existingPayinData.filter(data => data.status === Status.SUCCESS)
        }
    }
    else {
        getSuccessData = [];
    }

    const updatePayInData = {
        status: getBankResponseByUtr?.bankName != bank_name ? Status.BANK_MISMATCH : getSuccessData?.length > 0 ? Status.DUPLICATE :
            parseFloat(payInData?.amount) !== parseFloat(payInData?.confirmed) ? Status.DISPUTE : Status.SUCCESS,
        bank_name: bank_name,
        bank_acc_id: getBank.id,
        duration: duration,
    };

    if (updatePayInData.status === Status.SUCCESS) {
        updatePayInData.payin_commission = payinCommission;
        updatePayInData.amount = payInData.confirmed;
    }

    const updatePayInRes = await updatePayInUrlDao(payInData?.id, updatePayInData);

    //under development telegram API's
    await botResponseRepo.updateBotResponseByUtr(
        getBankResponseByUtr?.id,
        getBankResponseByUtr?.utr
    );

    //under development update bank API 
    await bankAccountRepo.updateBankAccountBalance(
        getBank?.id,
        parseFloat(payInData.confirmed)
    );

    const notifyData = {
        status: updatePayInRes?.status,
        merchantOrderId: updatePayInRes?.merchant_order_id,
        payinId: updatePayInRes?.id,
        amount: updatePayInRes?.confirmed,
        utr_id: updatePayInRes?.utr || ""
    };

    notifyMerchants(updatePayInRes.notify_url, notifyData)
    return {
        message: "PayIn data updated successfully"
    };
}

export const resetDepositService = async (merchant_order_id) => {
    const payInData = await getPayInUrlDao(merchant_order_id);
    //under development telegram API's
    await sendResetEntryTelegramMessage(
        config?.telegramEntryResetChatId,
        payInData,
        config?.telegramBotToken,
    );
    if (payInData?.status !== Status.SUCCESS && payInData?.status !== Status.FAILED) {
        const utr = payInData?.utr ? payInData?.utr : payInData?.user_submitted_utr
        //API's under construction
        const botRes = await botResponseRepo.getBotResByUtr(utr);

        const updatePayInData = {
            status: "ASSIGNED",
            confirmed: null,
            payin_commission: null,
            utr: null,
            user_submitted_utr: null,
            duration: null,
        };
        let getallPayinDataByUtr
        getallPayinDataByUtr = await getPayInUrlDao(utr);
        if (!getallPayinDataByUtr.length) {
            getallPayinDataByUtr = await payInRepo.getPayinDataByUsrSubmittedUtr(utr);
        }
        const hasSuccess = getallPayinDataByUtr.some((item) => item.status === Status.SUCCESS);

        if (!hasSuccess && botRes?.id) {
            //under development
            await botResponseRepo?.updateBotResponseToUnusedUtr(botRes?.id);
        }

        const updatePayInRes = await updatePayInUrlDao(payInData?.id, updatePayInData);

        return {
            updatePayInRes
        };
    }
    else {
        return Error("Transaction status is SUCCESS or FAILED, no update applied");
    }
}


const notifyMerchants = (url, data) => {
    if (url) {
        axios.post(url, data).catch(console.error);
    }
}