import config from "../../config/config.js";
import { ValidationError } from '../../utils/appErrors.js';
import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import {
    ASSIGN_PAYIN_SCHEMA, VALIDATE_ASSIGNED_BANT_TO_PAY, VALIDATE_CHECK_PAY_IN_STATUS,
    VALIDATE_EXPIRE_PAY_IN_URL, VALIDATE_PAY_IN_INTENT_GENERATE_ORDER, VALIDATE_PAYIN_SCHEMA, VALIDATE_RESET_DEPOSIT,
    VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS,
    VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS
} from "../../schemas/payInSchema.js";
import {
    assignedBankToPayInUrlService, checkPayInStatusService, expirePayInUrlService, generatePayInUrlService, getPayinsServiceById, getPayinsServiceByid, getPayInUrlService,
    payInIntentGenerateOrderService, resetDepositService, updateDepositStatusService, updatePaymentNotificationStatusService
} from "./payInService.js";

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
        return sendSuccess(res, updateRes, "Payment is assigned & url is sent successfully");
    }
    res.redirect(302, updateRes.payInUrl);
    return;
}

export const validatePayInUrl = async (req, res) => {
    const { payInId } = req.params;
    const joiValidation = VALIDATE_PAYIN_SCHEMA.validate(req.params);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }

    const payIn = await getPayInUrlService(payInId);
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
    const joiValidation = VALIDATE_ASSIGNED_BANT_TO_PAY.validate({
        ...req.params,
        ...req.body,
    });
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const result = await assignedBankToPayInUrlService(req.params.payInId, req.body.amount);
    return sendSuccess(res, result, 'Bank account is assigned');
};

export const expirePayInUrl = async (req, res) => {
    const joiValidation = VALIDATE_EXPIRE_PAY_IN_URL.validate(req.params);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    await expirePayInUrlService(req.body.payInId)
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
    const { payInId } = req.params;
    const { type } = req.body;
    const payload = { payInId, type };
    const joiValidation = VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const data = await updatePaymentNotificationStatusService(payInId, type)
    sendSuccess(res, data)
}

export const updateDepositStatus = (req, res) => {
    const { id } = req.params;
    const { bank_name } = req.body;
    const payload = {
        id,
        bank_name
    }
    const joiValidation = VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const updateRes = updateDepositStatusService(id, bank_name);
    sendSuccess(res, updateRes)
}

export const resetDeposit = async (req, res) => {
    const { merchant_order_id } = req.body;
    const joiValidation = VALIDATE_RESET_DEPOSIT.validate(merchant_order_id);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const data = await resetDepositService(merchant_order_id);
    sendSuccess(res, data)
}

export const getPayinsByUtrController = async (req, res) => {
    try {
        
        // Fetch vendors data from the service
        const data = await getPayinsServiceById(req);

        // Log success message
        console.log('getPayins successfully', data);

        // Send success response
        return sendSuccess(res, data, 'Payins fetched successfully');
    } catch (error) {
        // Log error
        console.error('error getting while fetching Payins Data',  error);

        // Send an error response
        return sendError(res, error, 'Error occurred while fetching Payins');
    }
};