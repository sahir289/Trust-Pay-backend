/* eslint-disable no-unused-vars */
import {
    BadRequestError,
    DuplicateDataError,
} from '../../utils/appErrors.js';
import { Buffer } from 'buffer';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import Logger from '../../utils/logger.js';
import { createPayoutDao, deletePayoutDao, getPayoutsDao, updatePayoutDao } from './payOutDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getCalculationDao, updateCalculationDao } from '../calculation/calculationDao.js';
import { updateBankaccountDao, getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import config from '../../config/config.js';

const logger = new Logger();

const createPayoutService = async (headers, payload) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn);

        const { merchant_id, amount, merchant_order_id } = payload;
        const { code, user_id, api_key, config } = await getMerchantsDao(merchant_id);
        const payoutAmount = Number(amount);
        const balanceRestriction = config.balanceRestriction;

        if (balanceRestriction) {
            const { totalNetBalance } = await getCalculationDao({ user_id });
            if (totalNetBalance < payoutAmount) {
                throw new BadRequestError('Insufficient Balance to create Payout');
            }
            const ekoBalanceEnquiry = await ekoWalletBalanceEnquiryInternally();
            if (Number(ekoBalanceEnquiry.data.balance) < payoutAmount) {
                throw new BadRequestError('Insufficient Balance in Wallet');
            }
        }

        if (!code) {
            throw new BadRequestError('Merchant does not exist');
        }

        if (headers['x-api-key'] !== api_key) {
            throw new BadRequestError('Enter valid Api key');
        }

        const merchantOrderIdPayoutData = merchant_order_id ? await getPayoutsDao(merchant_order_id) : '';
        if (merchantOrderIdPayoutData || merchantOrderIdPayoutData?.length > 0) {
            throw new DuplicateDataError('Merchant Order ID already exists');
        }

        const data = await createPayoutDao(payload);
        await commit(conn);
        logger.log('Payout created successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn);
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while creating Payout', 'error', error);
        throw new BadRequestError('Error occurred while creating Payout');
    } finally {
        if (conn) {
            try {
                conn.release();
            } catch (releaseError) {
                logger.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
};

const getPayoutsService = async (payload) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction (even if read-only)

        const data = await getPayoutsDao(payload);

        await commit(conn); // Commit transaction (even if no modifications)

        logger.log('Fetched Payouts successfully', 'info');
        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction if an error occurs
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while fetching Payouts', 'error', error);
        throw new BadRequestError('Error occurred while fetching Payouts');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                logger.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
};

const updatePayoutService = async (id, payload) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn);

        if (payload.utr_id && !payload.status) {
            Object.assign(payload, { status: "SUCCESS", approved_at: new Date() });
        }

        if (payload.rejected_reason) {
            Object.assign(payload, { status: "REJECTED", rejected_at: new Date() });
        }

        if (payload.status === "INITIATED") {
            Object.assign(payload, { utr_id: "", rejected_reason: "" });
        }

        const singleWithdrawData = await getPayoutsDao(id);

        if (payload?.method === 'eko') {
            await processEkoPayout(singleWithdrawData, payload);
        }

        const data = await updatePayoutDao(id, payload);
        const calculation = await getCalculationDao({ user_id: data.user_id });
        const bankData = await getBankaccountDao({ id: data.bank_acc_id });

        if (data.approved_at) {
            const isToday = new Date(data.approved_at).toDateString() === new Date().toDateString();
            const isRejectedToday = data.rejected_at && new Date(data.rejected_at).toDateString() === new Date().toDateString();

            if (data.status === "SUCCESS" && isToday) {
                await updateCalculationDao(calculation.id, {
                    total_payout_count: calculation.total_payout_count + 1,
                    total_payout_amount: calculation.total_payout_amount + data.amount,
                    total_payout_commission: calculation.total_payout_commission + data.commission
                });
                await updateBankaccountDao(bankData.id, {balance: bankData.balance - data.amount});
            } else if (data.status === "REJECTED" && isRejectedToday) {
                await updateCalculationDao(calculation.id, {
                    total_reverse_payout_count: calculation.total_reverse_payout_count + 1,
                    total_reverse_payout_amount: calculation.total_reverse_payout_amount + data.amount,
                    total_reverse_payout_commission: calculation.total_reverse_payout_commission + data.commission
                });
                await updateBankaccountDao(bankData.id, {balance: bankData.balance + data.amount});
            }
        }

        await commit(conn);

        logger.info('Payout updated successfully');
        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn);
            } catch (rollbackError) {
                logger.error('Error during transaction rollback', rollbackError);
            }
        }
        logger.error('Error while updating Payout', error);
        throw new BadRequestError('Error occurred while updating Payout');
    } finally {
        if (conn) {
            try {
                conn.release();
            } catch (releaseError) {
                logger.error('Error while releasing the connection', releaseError);
            }
        }
    }
};

const processEkoPayout = async (singleWithdrawData, payload) => {
    try {
        const client_ref_id = Math.floor(Date.now() / 1000);
        const ekoResponse = await createEkoWithdraw(singleWithdrawData, client_ref_id);

        if (ekoResponse?.status === 0) {
            const isSuccess = ekoResponse?.data?.txstatus_desc?.toUpperCase() == 'SUCCESS';
            Object.assign(payload, {
                status: isSuccess ? 'SUCCESS' : 'REJECTED',
                approved_at: isSuccess ? new Date() : null,
                rejected_at: isSuccess ? null : new Date(),
                utr_id: ekoResponse?.data?.tid
            });
            logger.info(`Payment initiated: ${ekoResponse?.message}`);
        } else {
            let getEkoPayoutStatus = null;
            if (ekoResponse.status === 1328) {
                getEkoPayoutStatus = await ekoPayoutStatus(client_ref_id);
            }
            Object.assign(payload, {
                status: 'REJECTED',
                rejected_reason: ekoResponse?.message,
                rejected_at: new Date(),
                utr_id: getEkoPayoutStatus?.data?.tid || null
            });
            logger.error(`Payment rejected by eko due to ${ekoResponse?.message}`);
        }
    } catch (error) {
        logger.error('Error processing Eko method:', error);
    }
};

const activateEkoService = async (req, res) => {

    const key = config?.ekoAccessKey;
    const encodedKey = Buffer.from(key).toString('base64');

    const secretKeyTimestamp = Date.now();
    const secretKey = crypto.createHmac('sha256', encodedKey).update(secretKeyTimestamp.toString()).digest('base64');

    // may be in future this will need
    // console.log('Secret Key:', secretKey);
    // console.log('Secret Timestamp:', secretKeyTimestamp);

    const encodedParams = new URLSearchParams();
    encodedParams.set('service_code', config?.ekoServiceCode);
    encodedParams.set('user_code', config?.ekoUserCode);
    encodedParams.set('initiator_id', config?.ekoInitiatorId);

    const url = config?.ekoPaymentsActivateUrl;
    const options = {
        method: 'PUT',
        headers: {
            accept: 'application/json',
            developer_key: config?.ekoDeveloperKey,
            'secret-key': secretKey,
            'secret-key-timestamp': secretKeyTimestamp,
            'content-type': 'application/x-www-form-urlencoded'
        },
        body: encodedParams
    };
    try {
        const response = await fetch(url, options);
        const responseText = await response.text();

        let parsedData;
        try {
            parsedData = JSON.parse(responseText);
        } catch (err) {
            logger.error(err);
            parsedData = responseText;
        }

        return parsedData;

    } catch (error) {
        logger.error(error)
    }
}

const createEkoWithdraw = async (payload, client_ref_id) => {

    const newObj = {
        amount: payload?.amount,
        client_ref_id,
        recipient_name: payload?.acc_holder_name,
        ifsc: payload?.ifsc_code,
        account: payload?.acc_no,
        sender_name: "TrustPay"
    }

    const key = config?.ekoAccessKey;
    const encodedKey = Buffer.from(key).toString('base64');

    const secretKeyTimestamp = Date.now();
    const secretKey = crypto.createHmac('sha256', encodedKey).update(secretKeyTimestamp.toString()).digest('base64');

    const encodedParams = new URLSearchParams();
    encodedParams.set('service_code', config?.ekoServiceCode);
    encodedParams.set('initiator_id', config?.ekoInitiatorId);
    encodedParams.set('amount', newObj.amount);
    encodedParams.set('payment_mode', '5');
    encodedParams.set('client_ref_id', newObj.client_ref_id);
    encodedParams.set('recipient_name', newObj.recipient_name);
    encodedParams.set('ifsc', newObj.ifsc);
    encodedParams.set('account', newObj.account);
    encodedParams.set('sender_name', newObj.sender_name);
    encodedParams.set('source', 'NEWCONNECT');
    encodedParams.set('tag', 'Logistic');
    encodedParams.set('beneficiary_account_type', 1);

    const url = `${config?.ekoPaymentsInitiateUrl}:${config?.ekoUserCode}/settlement`;
    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            developer_key: config?.ekoDeveloperKey,
            'secret-key': secretKey,
            'secret-key-timestamp': secretKeyTimestamp,
            'content-type': 'application/x-www-form-urlencoded'
        },
        body: encodedParams
    };

    try {
        const response = await fetch(url, options);
        const responseText = await response.text();

        let parsedData;
        try {
            parsedData = JSON.parse(responseText);
        } catch (err) {
            logger.error(err);
            parsedData = responseText;
        }
        return parsedData;
    } catch (error) {
        logger.error(error);
    }
}

const ekoPayoutStatus = async (id, res) => {
    // const {id} = req.params; // here id wil be client_ref_id (unique)
    const key = config?.ekoAccessKey;
    const encodedKey = Buffer.from(key).toString('base64');

    const secretKeyTimestamp = Date.now();
    const secretKey = crypto.createHmac('sha256', encodedKey).update(secretKeyTimestamp.toString()).digest('base64');

    const url = `${config?.ekoPaymentsStatusUrlByClientRefId}${id}?initiator_id=${config?.ekoInitiatorId}`;
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            developer_key: config?.ekoDeveloperKey,
            'secret-key': secretKey,
            'secret-key-timestamp': secretKeyTimestamp,
            'content-type': 'application/x-www-form-urlencoded'
        },
    };

    try {
        const response = await fetch(url, options);
        const responseText = await response.text();

        let parsedData;
        try {
            parsedData = JSON.parse(responseText);

        } catch (err) {
            logger.error(err);
            parsedData = responseText;
        }
        return parsedData;
    } catch (error) {
        logger.error(error);
    }
}

const deletePayoutService = async (id) => {
    let conn;
    try {
        conn = await getConnection();
        await beginTransaction(conn); // Start a transaction
        const payload = { is_obsolete: true };

        const data = await deletePayoutDao(id, payload); // Adjust DAO call for delete

        await commit(conn); // Commit the transaction
        logger.log('Payout deleted successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while deleting Payout', 'error', error);
        throw new BadRequestError('Error occurred while deleting Payout');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                logger.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
};

const ekoWalletBalanceEnquiryInternally = async () => {
    const key = config?.ekoAccessKey;
    const encodedKey = Buffer.from(key).toString('base64');

    const secretKeyTimestamp = Date.now();
    const secretKey = crypto.createHmac('sha256', encodedKey).update(secretKeyTimestamp.toString()).digest('base64');

    const url = `${config?.ekoWalletBalanceEnquiryUrl}:${config?.ekoRegisteredMobileNo}/balance?initiator_id=${config?.ekoInitiatorId}&user_code=${config?.ekoUserCode}`;
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            developer_key: config?.ekoDeveloperKey,
            'secret-key': secretKey,
            'secret-key-timestamp': secretKeyTimestamp,
            'content-type': 'application/x-www-form-urlencoded'
        },
    };

    try {
        const response = await fetch(url, options);
        const responseText = await response.text();

        let parsedData;
        try {
            parsedData = JSON.parse(responseText);
        } catch (err) {
            logger.error(err);
            parsedData = responseText;
        }
        return parsedData;
    } catch (error) {
        logger.error(error);
    }
}

export { createPayoutService, getPayoutsService, updatePayoutService, deletePayoutService };
