import { ASSIGN_PAYIN_SCHEMA } from "../../schemas/payInSchema.js";
import { CustomError, ValidationError } from '../../utils/appErrors.js';
import Logger from "../../utils/logger.js";
import { getMerchantsService } from "../merchants/merchantService.js";

const logger = new Logger();

//  To Generate Url
export const generatePayInUrl = async (req, res, next) => {
    const payload = req.query;
    const joiValidation = ASSIGN_PAYIN_SCHEMA.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    let payInData;
    const { code, user_id, merchant_order_id, ot, isTest, amount, returnUrl, ap } = payload;
    // If query parameters are provided, use them
    const merchantArr = await getMerchantsService({ code });
    const merchant = merchantArr[0];
    console.log("RES", merchant);
    
    if (!merchant) {
        throw new CustomError(404, "Merchant does not exist");
    }

    
    // if (ap && ap !== merchant.api_key) {
    //     throw new CustomError(404, "Enter valid Api key");
    // }

    // if (!ap && req.headers["x-api-key"] !== merchant.api_key) {
    //     throw new CustomError(404, "Enter valid Api key");
    // }

    const bankAccountLinkRes = await bankAccountRepo.getMerchantBankById(merchant?.id);
    const payInBankAccountLinkRes = bankAccountLinkRes?.filter(payInBank => payInBank?.bankAccount?.bank_used_for === "payIn");
    const availableBankAccounts = payInBankAccountLinkRes?.filter(bank => (bank?.bankAccount?.is_bank === true || bank?.bankAccount?.is_qr === true) && bank?.bankAccount?.is_enabled === true);
    if (!availableBankAccounts || availableBankAccounts.length === 0) {
        // Send alert if no bank account is linked
        await sendBankNotAssignedAlertTelegram(
            config?.telegramBankAlertChatId,
            merchant,
            config?.telegramBotToken,
        );
        throw new CustomError(404, "Bank Account has not been linked with Merchant");
    }

    if (!merchant_order_id && ot) {
        payInData = {
            code: code,
            amount,
            api_key: merchant?.api_key,
            merchant_order_id: uuidv4(),
            user_id: user_id,
            return_url: returnUrl ? returnUrl : merchant?.return_url,
            // isTest:isTest
        };
        // Uncomment and use your service to generate PayIn URL
        const generatePayInUrlRes = await payInServices.generatePayInUrl(
            merchant,
            payInData,
            bankAccountLinkRes[0] // to add the bank_id when url is generated from api
        );
        let updateRes;
        if (isTest && (isTest === 'true' || isTest === true)) {
            updateRes = {
                expirationDate: generatePayInUrlRes?.expirationDate,
                payInUrl: `${config.reactPaymentOrigin}/transaction/${generatePayInUrlRes?.id}?t=true`, // use env
                payInId: generatePayInUrlRes?.id,
                merchantOrderId: merchant_order_id,
            };
        } else {
            updateRes = {
                expirationDate: generatePayInUrlRes?.expirationDate,
                payInUrl: `${config.reactPaymentOrigin}/transaction/${generatePayInUrlRes?.id}`, // use env
                payInId: generatePayInUrlRes?.id,
                merchantOrderId: merchant_order_id,

            };
        }

        if (ot === "y") {
            return DefaultResponse(
                res,
                200,
                "Payment is assigned & url is sent successfully",
                updateRes
            );
        } else {
            res.redirect(302, updateRes?.payInUrl);
        }
    } else {
        payInData = {
            code,
            merchant_order_id,
            user_id,
            amount,
            return_url: returnUrl ? returnUrl : merchant?.return_url,
        };

        const generatePayInUrlRes = await payInServices.generatePayInUrl(
            merchant,
            payInData,
            bankAccountLinkRes[0] // to add the bank_id when url is generated from api
        );
        const updateRes = {
            expirationDate: generatePayInUrlRes?.expirationDate,
            payInUrl: `${config.reactPaymentOrigin}/transaction/${generatePayInUrlRes?.id}`, // use env
            payInId: generatePayInUrlRes?.id,
            merchantOrderId: merchant_order_id,
        };
        return DefaultResponse(
            res,
            200,
            "Payment is assigned & url is sent successfully",
            updateRes
        );
    }
}