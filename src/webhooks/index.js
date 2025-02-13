import { updatePayInUrlDao } from "../apis/payIn/payInDao";
import { getPayInUrlService, notifyMerchants } from "../apis/payIn/payInService";
import { Status } from "../constants";

const payInUpdateCashfreeWebhook = async (req, res) => {
    const payload = req.body;
    res.json({ status: 200, message: 'Cash free Webhook Called successfully' });
    const payInDataById = await getPayInUrlService(payload.data.order.order_id);
    if (!payInDataById) {
        Error('Payment not found');
    }

    const durMs = new Date() - payInDataById.createdAt;
    const durSeconds = Math.floor((durMs / 1000) % 60).toString().padStart(2, '0');
    const durMinutes = Math.floor((durSeconds / 60) % 60).toString().padStart(2, '0');
    const durHours = Math.floor((durMinutes / 60) % 24).toString().padStart(2, '0');
    const duration = `${durHours}:${durMinutes}:${durSeconds}`;

    if (payload.data.payment.payment_status === Status.FAILED || payload.data.payment.payment_status === Status.USER_DROPPED) {
        Error('Payment Failed due to:', payload.data.payment.payment_message);
    }

    const payInData = {
        confirmed: payload.data.order.order_amount,
        amount: payload.data.order.order_amount,
        status: payload.data.payment.payment_status === Status.USER_DROPPED ? Status.DROPPED : payload.data.payment.payment_status,
        utr: payload.data.payment.bank_reference,
        user_submitted_utr: payload.data.payment.bank_reference,
        approved_at: new Date(),
        is_url_expires: true,
        user_submitted_image: null,
        duration: duration,
        method: 'CashFree',
        is_notified: true
    }

    const updatePayinRes = await updatePayInUrlDao(payInDataById.id, payInData);
    const notifyData = {
        status: updatePayinRes?.status,
        merchantOrderId: updatePayinRes?.merchant_order_id,
        payinId: payInDataById.id,
        amount: updatePayinRes?.confirmed,
        req_amount: amount,
        utr_id: (updatePayinRes?.status === Status.SUCCESS || updatePayinRes?.status === Status.DISPUTE) ? updatePayinRes?.utr : ""
    };

    notifyMerchants(payInData?.config?.notify_url, notifyData)
    const notifyMerchant = await axios.post(payInData.notify_url, notifyData);
    return {
        notifyMerchant
    }
}

