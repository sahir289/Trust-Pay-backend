import { Cashfree } from 'cashfree-pg';
import { Currency } from '../constants/index.js';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';
import { BadRequestError } from '../utils/appErrors.js';

const env =
  config.env === 'production' ? Cashfree.PRODUCTION : Cashfree.SANDBOX;
const clientId =
  config.env === 'production'
    ? config.cashfree.clientIdProd
    : config.cashfree.clientIdTest;
const clientSecret =
  config.env === 'production'
    ? config.cashfree.clientSecretProd
    : config.cashfree.clientSecretTest;

const cashfree = new Cashfree(env, clientId, clientSecret);

export const createCashfreeOrder = async (deposit, amount) => {
  try {
    const requestBody = {
      order_amount: amount || deposit?.amount,
      order_currency: Currency.INR,
      customer_details: {
        customer_id: deposit?.user,
        customer_email: 'test@gmail.com',
        customer_phone: '9999999999',
      },
      order_meta: {
        return_url: deposit?.config.urls.return,
        payment_methods: 'upi',
      },
    };
    const cashFreeResponse = await cashfree.PGCreateOrder(requestBody);
    const data = cashFreeResponse.data;
    return data;
  } catch (error) {
    logger.error('Cashfree order creation error:', err.response?.data || err.message);
  }

  //   const requestBody = JSON.stringify({
  //     order_amount: deposit.amount,
  //     order_currency: Currency.INR,
  //     customer_details: {
  //       customer_id: deposit.user,
  //       customer_phone: '9098989999',
  //     },
  //   });

  //   console.log(requestBody, '97y39y383');

  //   const url = 'https://sandbox.cashfree.com/pg/orders';
  //   const options = {
  //     method: 'POST',
  //     headers: {
  //       'x-client-id': config.cashfree.clientId,
  //       'x-client-secret': config.cashfree.clientSecret,
  //       'x-api-version': '2025-01-01',
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       order_amount: deposit.amount,
  //       order_currency: Currency.INR,
  //       customer_details: {
  //         customer_id: deposit.user,
  //         customer_phone: '9098989999',
  //       },
  //     }),
  //   };

  //   try {
  //     const response = await fetch(url, options);
  //     const data = await response.json();
  //     return data;
  //   } catch (error) {
  //     console.error(error);
  //   }
};

// export const cashfreeWebHook = async (req, res) => {
//   try {
//     const signature = req.headers['x-cfsignature'];
//     if (
//       Cashfree.verifyWebhook(
//         req.body,
//         signature,
//         process.env.CASHFREE_CLIENT_SECRET,
//       )
//     ) {
//       // Process event (e.g., if linked_order_id and status === "TXN_SUCCESS")
//       console.log('Valid webhook:', req.body);
//       res.status(200).send('OK');
//     } else {
//       res.status(401).send('Invalid signature');
//     }
//   } catch (error) {
//     logger.error('Cashfree webhook error:', error.message);
//   }
// };

export async function payOrder(sessionId) {
  try {
    if (!sessionId.startsWith('session_')) {
      throw new BadRequestError('Invalid sessionId format');
    }
    const cleanSessionId = sessionId.replace(/paymentpayment$/, '');
    const requestBody = {
      payment_method: {
        upi: {
          channel: 'link', // or "qrcode" or "intent"
          //   upi_id: vpa || 'testsuccess@gocash', // e.g. "testsuccess@gocash"
        },
      },
    };

    const response = await cashfree.PGPayOrder(cleanSessionId, requestBody);
    const data = response.data;

    return data;
  } catch (err) {
    logger.error(
      'Error while paying order:',
      err.response?.data || err.message,
    );
    throw err;
  }

  //   const cleanSessionId = sessionId.replace(/paymentpayment$/, '');
  //   const url = 'https://api.cashfree.com/pg/orders/sessions';
  //   const options = {
  //     method: 'POST',
  //     headers: {
  //       'x-api-version': '2025-01-01',
  //       'x-request-id': '298ey92ye98y2e',
  //       'x-idempotency-key': payinId,
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       payment_session_id: sessionId,
  //       payment_method: {
  //         upi: {
  //           channel: 'link',
  //         },
  //       },
  //     }),
  //   };

  //   try {
  //     const response = await fetch(url, options);
  //     const data = await response.json();
  //     console.log(data, '9098809898988890');
  //     return data;
  //   } catch (error) {
  //     console.error(error);
  //   }
}
