import { nanoid } from 'nanoid'
import { Currency, Status, Type } from "../../constants/index.js";
import { generatePayInUrlDao, updatePayInUrlDao, getPayInUrlDao } from "./payInDao.js";
import { getMerchantsService } from "../merchants/merchantService.js";
import { AccessDeniedError, BadRequestError, NotFoundError } from "../../utils/appErrors.js";
import { v4 as uuidv4 } from "uuid";
import { getBankaccountDao, getMerchantBankDao, updateBankaccountDao } from "../bankAccounts/bankaccountDao.js";
import { razorpay } from "../../webhooks/razorPay.js";
import config from "../../config/config.js";
import { Cashfree } from "cashfree-pg";
// import { calculateCommission } from "../../utils/utils.js";
import dayjs from "dayjs";
import { merchantPayinCallback } from "../../callBacksAndWebHook/merchantCallBacks.js";
import { getPayoutsDao } from '../payOut/payOutDao.js';
import { calculateDuration } from '../../utils/utils.js';

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

    const bankAccountLinkRes = await getMerchantBankDao(merchant.user_id);
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

    const expirationDate = dayjs().add(10, 'minutes').toISOString();
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

    const currentTime = Date.now();
    const payIn = await getPayInUrlDao({ id });

    if (!payIn) {
        throw new NotFoundError("Payment Url is incorrect");
    }

    if (payIn.is_url_expires) {
        throw new BadRequestError("Url is expired");
    }

    const config = payIn.config || {};
    if (currentTime > Number(payIn.expiration_date) && payIn.status !== Status.INITIATED) {
        // expire payIn
        await updatePayInUrlDao(id, {
            is_url_expires: true,
            status: Status.DROPPED,
        });
        // Notifying merchant about expired URL
        merchantPayinCallback(config.notify_url, {
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
    // const currentTime = Date.now();
    const payIn = await getPayInUrlDao({ id: payInId });
    if (!payIn) {
        throw new NotFoundError('PayIn not found!');
    }
    checkIsPayInExpired(payIn);
    const config = payIn.config || {};
    await updatePayInUrlDao(payInId, {
        is_url_expires: true,
        status: Status.DROPPED,
    })

    merchantPayinCallback(config.notify_url, {
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

    checkIsPayInExpired(payIn);
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
    const banks = await getMerchantBankDao(merchant.user_id);
    const enabledBanks = banks.filter((bank) => bank.is_enabled && bank.bank_used_for === "payIn")
    if (!enabledBanks.length) {
        await updatePayInUrlDao(payInId, {
            is_url_expires: true,
            status: Status.DROPPED,
        });
        merchantPayinCallback(payInConfig.notify_url, {
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
        one_time_used: true,
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
    // validating if it exist
    const payIn = await getPayInUrlService(payInId);
    checkIsPayInExpired(payIn);
    if (isRazorpay) {
        const orderRes = await razorpay.orders.create({
            amount: amount * 100,
            currency: Currency.INR,
            receipt: payInId,
        });

        return {
            status: orderRes.status
        };
    }

    const requestBody = {
        "order_amount": amount,
        "order_currency": Currency.INR,
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

    if (!Object.values(Type).includes(type)) {
        throw new Error("Invalid notification type.");
    }

    if (type === Type.PAYIN) {
        const payIn = await updatePayInUrlDao(payInId, { is_notified: true });
        if (!payIn) {
            throw new Error("Payin data not found.");
        }
        return await merchantPayinCallback(payIn.config?.notify_url, {
            status: payIn.status,
            merchantOrderId: payIn.merchant_order_id,
            payinId: payIn.id,
            amount: payIn.confirmed,
            utr_id: payIn.utr || "",
        });
    }

    if (type === Type.PAYOUT) {
        const payouts = await getPayoutsDao({ id: payInId });
        const payout = payouts[0];
        if (!payout.length) {
            throw new NotFoundError("Payout data not found.");
        }

        const merchants = await getMerchantsService({ id: payout.merchant_id });
        const merchant = merchants[0];
        if (!merchant || !merchant.payout_notify_url) {
            throw new NotFoundError("Merchant or payout notify URL not found.");
        }

        return await merchantPayinCallback(merchant.config?.payout_notify_url, {
            code: payout.code,
            merchantOrderId: payout.merchant_order_id,
            payoutId: payout.id,
            amount: payout.amount,
            status: payout.status,
            utr_id: payout.utr_id || "",
        });
    }
}

//under development..
export const updateDepositStatusService = async (merchantId, nick_name) => {
    const payInData = await getPayInUrlService(merchantId);

    if (!payInData) {
        throw NotFoundError("PayIn data not found")
    }
    if (payInData.status !== Status.BANK_MISMATCH) {
        throw Error("Status is not BANK_MISMATCH, no update applied")
    }
    // //call the Bank Res API
    // const getBankResponseByUtr = await botResponseRepo.getBotResByUtr(
    //     payInData?.utr
    // );

    //calculate the payin commission 
    const payinCommission = calculateCommission(
        getBankResponseByUtr?.amount,
        payInData?.Merchant?.payin_commission
    );

    const duration = calculateDuration(payInData.createdAt)

    // //get bank by nick name api under construction..
    const getBank = await getBankaccountDao(nick_name);

    let getSuccessData = [];
    if (getBankResponseByUtr.is_used) {
        let existingPayinData = await getPayInUrlDao({ user_submitted_utr: getBankResponseByUtr.user_submitted_utr });
        if (existingPayinData.length) {
            getSuccessData = existingPayinData.filter(data => data.status === Status.SUCCESS)
        }
    }

    const updatePayInData = {
        status: getBankResponseByUtr.nick_name != nick_name ? Status.BANK_MISMATCH : getSuccessData?.length > 0 ? Status.DUPLICATE :
            //payInData.confirmed column is not exist in database instead of confirmed add amount
            parseFloat(payInData.amount) !== parseFloat(payInData.amount) ? Status.DISPUTE : Status.SUCCESS,
        nick_name,
        bank_acc_id: getBank.id,
        duration: duration,
    };

    if (updatePayInData.status === Status.SUCCESS) {
        updatePayInData.payin_merchant_commission = payinCommission;
        //payInData.confirmed column is not exist in database
        updatePayInData.amount = payInData.amount;
    }

    const updatePayInRes = await updatePayInUrlDao(payInData.id, updatePayInData);

    // //under development telegram API's
    // await botResponseRepo.updateBotResponseByUtr(
    //     getBankResponseByUtr?.id,
    //     getBankResponseByUtr?.utr
    // );

    // //under development update bank API 
    await updateBankaccountDao(
        getBank?.id,
        //payInData.confirmed column is not exist in database instead of confirmed add amount
        parseFloat(payInData.amount)
    );

    return await merchantPayinCallback(updatePayInRes.notify_url, {
        status: updatePayInRes.status,
        merchantOrderId: updatePayInRes.merchant_order_id,
        payinId: updatePayInRes.id,
        //payInData.confirmed column is not exist in database instead of confirmed add amount
        amount: updatePayInRes.amount,
        utr_id: updatePayInRes.user_submitted_utr || ""
    });
}

export const resetDepositService = async (merchant_order_id) => {
    const payInData = await getPayInUrlDao(merchant_order_id);
    // //under development telegram API's
    // await sendResetEntryTelegramMessage(
    //     config?.telegramEntryResetChatId,
    //     payInData,
    //     config?.telegramBotToken,
    // );
    if (!payInData) {
        throw new NotFoundError("Payin date not found");
    }
    if (payInData.status !== Status.SUCCESS && payInData.status !== Status.FAILED) {
        const utr = payInData.user_submitted_utr
        //API's under construction
        // const botRes = await botResponseRepo.getBotResByUtr(utr);

        const updatePayInData = {
            status: Status.ASSIGNED,
            //confirmed column is not exist in database instead of confirmed add amount
            amount: null,
            payin_merchant_commission: null,
            user_submitted_utr: null,
            duration: null,
        };

        const getallPayinDataByUtr = await getPayInUrlDao({ utr });
        const hasSuccess = getallPayinDataByUtr.some((item) => item.status === Status.SUCCESS);

        //     //under development
        // if (!hasSuccess && botRes?.id) {
        //     await botResponseRepo?.updateBotResponseToUnusedUtr(botRes?.id);
        // }

        return await updatePayInUrlDao(payInData.id, updatePayInData);
    }
}


const checkIsPayInExpired = (payIn) => {
    if (Number(payIn.expiration_date) < Date.now() || payIn.is_url_expires) {
        throw new BadRequestError('PayIn has been expired already!');
    }

    return false;
}