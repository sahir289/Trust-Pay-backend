import config from "../../config/config.js";
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { sendError } from "../../utils/responseHandlers.js";
import { updatePayInUrlDao } from "./payInDao.js";
import {
    ASSIGN_PAYIN_SCHEMA,
    VALIDATE_ASSIGNED_BANT_TO_PAY,
    VALIDATE_CHECK_PAY_IN_STATUS,
    // VALIDATE_CHECK_PAY_IN_STATUS,
    VALIDATE_CHECK_UTR,
    VALIDATE_DISPUTE_DUPLICATE_TRANSACTION,
    VALIDATE_EXPIRE_PAY_IN_URL,
    VALIDATE_PAY_IN_INTENT_GENERATE_ORDER,
    VALIDATE_PAYIN_SCHEMA, VALIDATE_PROCESSE_PAYIN,
    VALIDATE_PROCESSE_PAYIN_BY_IMAGE,
    VALIDATE_RESET_DEPOSIT,
    VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS,
    VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS
} from "../../schemas/payInSchema.js";
import {
    assignedBankToPayInUrlService, getPayinsService,
    checkPayInStatusService,
    disputeDuplicateTransactionService,
    expirePayInUrlService,
    generatePayInUrlService,
    getPayInUrlService,
    payInIntentGenerateOrderService,
    processPayInByImageService,
    processPayInService,
    resetDepositService,
    telegramCheckUTRService,
    telegramResponseService,
    updateDepositStatusService,
    updatePaymentNotificationStatusService
} from "./payInService.js";
import { transactionWrapper } from "../../utils/db.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { streamToBase64 } from "../../helpers/index.js";
import { s3 } from "../../helpers/Aws.js";
import { stringifyJSON } from "../../utils/index.js";

//  To Generate Url
export const generatePayInUrl = async (req, res) => {
    const payload = req.query;
    const joiValidation = ASSIGN_PAYIN_SCHEMA.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const x_api_key = req.headers["x-api-key"];
    const result = await generatePayInUrlService({
        ...payload,
        x_api_key,
    });

    const queryStr = payload.isTest && (payload.isTest === 'true' || payload.isTest === true) ? `?t=true` : '';
    const updateRes = {
        expirationDate: result.expirationDate,
        payInUrl: `${config.reactPaymentOrigin}/transaction/${result.id}${queryStr}`, // use env
        payInId: result.id,
        merchantOrderId: result.merchant_order_id,
    };

    if (payload.ot === "y") {
        return sendSuccess(res, updateRes, "PayIn is generate & url is sent successfully");
    }
    res.redirect(302, updateRes.payInUrl);
    return;
}

/**
 * @type import('express').RequestHandler
 */
export const validatePayInUrl = async (req, res) => {
    const { payInId } = req.params;
    const joiValidation = VALIDATE_PAYIN_SCHEMA.validate(req.params);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const user_location = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const payIn = await getPayInUrlService(payInId);
    const updatedConfig = stringifyJSON({
        ...payIn.config,
        user: user_location
    });
    await updatePayInUrlDao(payIn.id, { config: updatedConfig });
    const result = {
        code: payIn.upi_short_code,
        return_url: config.return_url,
        notify_url: config.notify_url,
        expiryTime: payIn.expiration_date,
        amount: payIn.amount,
        one_time_used: payIn.one_time_used,
        status: payIn.status,
    };

    return sendSuccess(res, result, 'Payment Url is correct');
}

export const assignedBankToPayInUrl = async (req, res) => {
    ;
    const joiValidation = VALIDATE_ASSIGNED_BANT_TO_PAY.validate({
        ...req.params,
        ...req.body,
    });
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const result = await assignedBankToPayInUrlService(req.params.payInId, req.body.amount, req.body.type);
    return sendSuccess(res, result, 'Bank account is assigned');
};

export const expirePayInUrl = async (req, res) => {
    const joiValidation = VALIDATE_EXPIRE_PAY_IN_URL.validate(req.params);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    await expirePayInUrlService(req.params.payInId)
    return sendSuccess(res, null, 'Payin expires!');
}

export const checkPayInStatus = async (req, res) => {
    const joiValidation = VALIDATE_CHECK_PAY_IN_STATUS.validate(req.body);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const api_key = req.headers["x-api-key"];
    const data = await checkPayInStatusService(req.body.payInId, req.body.merchantCode, req.body.merchantOrderId, api_key);
    sendSuccess(res, data);
}

export const payInIntentGenerateOrder = async (req, res) => {
    const { payInId } = req.params;
    const { amount, isRazorpay } = req.body;
    const payload = { payInId, amount, isRazorpay };
    const joiValidation = VALIDATE_PAY_IN_INTENT_GENERATE_ORDER.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const data = await payInIntentGenerateOrderService(payInId, amount, isRazorpay);
    sendSuccess(res, data);
}

export const updatePaymentNotificationStatus = async (req, res) => {
    const joiValidation = VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS.validate({
        ...req.params,
        ...req.body,
    });
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const data = await updatePaymentNotificationStatusService(req.params.payInId, req.body.type, req.user.company_id)
    sendSuccess(res, data)
}

export const updateDepositStatus = async (req, res) => {
    const { merchantOrderId } = req.params;
    const { nick_name } = req.body;
    const payload = {
        merchantOrderId,
        nick_name
    }
    const joiValidation = VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const updateRes = await transactionWrapper(updateDepositStatusService)(merchantOrderId, nick_name, req.user.company_id);
    sendSuccess(res, updateRes, 'PayIn data updated successfully');
}

export const resetDeposit = async (req, res) => {
    const { merchant_order_id } = req.body;
    const joiValidation = VALIDATE_RESET_DEPOSIT.validate(req.body);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const data = await transactionWrapper(resetDepositService)(merchant_order_id, req.user.company_id);
    sendSuccess(res, data)
}
export const getPayins = async (req, res) => {
    try {
        // const payload = req.query.search;
        const { company_id } = req.user;
        const data = await getPayinsService({
            company_id,
            // Todo: Search
        });
        console.log('getPayins successfully', data);
        return sendSuccess(res, data, 'Payins fetched successfully');
    } catch (error) {
        // Log error
        console.error('error getting while fetching Payins Data', error);

        // Send an error response
        return sendError(res, error, 'Error occurred while fetching Payins');
    }
};

export const processPayIn = async (req, res) => {
    const payload = {
        ...req.body,
        ...req.params,
    }
    const joiValidation = VALIDATE_PROCESSE_PAYIN.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }

    const data = await transactionWrapper(processPayInService)(payload);
    sendSuccess(res, data);
}

export const telegramOCR = async (req, res) => {
    sendSuccess(res, 'API Called Successfully!');
    const message = req.body.message;

    if (!message || typeof message !== 'object') {
        console.error('No Telegram Message found!', message);
        return;
    }

    await transactionWrapper(telegramResponseService)(message);

}

export const processPayInByImage = async (req, res) => {
    const payload = {
        ...req.body,
        ...req.params,
    }
    const joiValidation = VALIDATE_PROCESSE_PAYIN_BY_IMAGE.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }

    if (!req.file) {
        throw BadRequestError('Image File not found!');
    }

    const command = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: req.file.key,
    });

    const { Body } = await s3.send(command);
    const base64Image = await streamToBase64(Body);

    const data = await transactionWrapper(processPayInByImageService)({
        ...payload,
        base64Image,
        fileKey: req.file.key,
    })

    sendSuccess(res, data);

}

export const disputeDuplicateTransaction = async (req, res) => {
    const payload = {
        ...req.body,
        ...req.params,
    }
    const joiValidation = VALIDATE_DISPUTE_DUPLICATE_TRANSACTION.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }

    const data = await transactionWrapper(disputeDuplicateTransactionService)(payload, req.user.company_id);
    sendSuccess(res, data);
}

export const telegramCheckUTR = async (req, res) => {
    const { utr, merchantOrderId } = req.body;
    const joiValidation = VALIDATE_CHECK_UTR.validate(req.body);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const result = await transactionWrapper(telegramCheckUTRService)(utr, merchantOrderId);
    sendSuccess(res, result);
}
