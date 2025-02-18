/* eslint-disable no-unused-vars */
import {BadRequestError,DuplicateDataError,} from '../../utils/appErrors.js';
import { Buffer } from 'buffer';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { createPayoutDao, deletePayoutDao, getPayoutsDao, updatePayoutDao } from './payOutDao.js';
import { getMerchantsDao, updateMerchantDao } from '../merchants/merchantDao.js';
import { getVendorsDao, updateVendorDao } from '../vendors/vendorDao.js';
import { getCalculationDao, updateCalculationDao } from '../calculation/calculationDao.js';
import { updateBankaccountDao, getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import config from '../../config/config.js';
import { merchantPayoutCallback } from '../../callBacksAndWebHook/merchantCallBacks.js';
import { getUserByIdDao } from '../users/userDao.js';
import { Status, Method } from '../../constants/index.js'
import { calculateBalances } from '../../helpers/index.js';

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
        console.log('Payout created successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn);
            } catch (rollbackError) {
                console.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        console.log('Error while creating Payout', 'error', error);
        throw new BadRequestError('Error occurred while creating Payout');
    } finally {
        if (conn) {
            try {
                conn.release();
            } catch (releaseError) {
                console.log('Error while releasing the connection', 'error', releaseError);
            }
        }
    }
};

const getPayoutsService = async (payload) => {
    const data = await getPayoutsDao(payload);

    console.log('Fetched Payouts successfully', 'info');
    return data;
};

const updatePayoutService = async (conn, id, payload) => {
    // Set default statuses based on input conditions
    if (payload.utr_id && !payload.status) Object.assign(payload, { status: Status.SUCCESS, approved_at: new Date() });
    if (payload.rejected_reason) Object.assign(payload, { status: Status.REJECTED, rejected_at: new Date() });
    if (payload.status === Status.INITIATED) Object.assign(payload, { utr_id: "", rejected_reason: "" });

    const singleWithdrawData = await getPayoutsDao(id);
    if (payload?.method === Method.EKO) await processEkoPayout(singleWithdrawData, payload);

    // Update payout status and retrieve necessary data
    const data = await updatePayoutDao(id, payload, conn);
    if (!data.approved_at) return;

    // Fetch required user details
    const bankData = await getBankaccountDao({ id: data.bank_acc_id });
    const [merchant, vendor, user] = await Promise.all([
        getMerchantsDao({ id: data.merchant_id }),
        getVendorsDao({ id: data.user_id }),
        getUserByIdDao({ id: bankData.user_id })
    ]);

    if (data.status === Status.SUCCESS) {
        const netBalance = await updatePayoutCalculations(data.merchant_id, data.approved_at, data.amount, data.commission, true, false, conn);
        const netVendorBalance = await updatePayoutCalculations(user.id, data.approved_at, data.amount, data.commission, false, false, conn);
        await updateBankaccountDao(bankData.id, { today_balance: bankData.today_balance - data.amount, balance: bankData.balance - data.amount }, conn);
        await updateMerchantDao(merchant.id, { balance: netBalance }, conn);
        await updateVendorDao(vendor.id, { balance: netVendorBalance }, conn);
    } else if (data.status === Status.REJECTED) {
        const netBalance = await updatePayoutCalculations(data.merchant_id, data.rejected_at, data.amount, data.commission, true, true, conn);
        const netVendorBalance = await updatePayoutCalculations(user.id, data.rejected_at, data.amount, data.commission, false, true, conn);
        await updateBankaccountDao(bankData.id, { today_balance: bankData.today_balance + data.amount, balance: bankData.balance - data.amount }, conn);
        await updateMerchantDao(merchant.id, { balance: netBalance }, conn);
        await updateVendorDao(vendor.id, { balance: netVendorBalance }, conn);
    }

    await merchantPayoutCallback(data.config?.urls?.payout_notify_url, {
        code: data.code,
        merchantOrderId: data.merchant_order_id,
        payoutId: data.id,
        amount: data.amount,
        status: data.status,
        utr_id: data.utr_id || "",
    });

    console.info('Payout updated successfully');
    return data;
};

// Function to update calculations
const updatePayoutCalculations = async (userId, date, amount, commission, isMerchant, isReverse = false, conn) => {
    const [currentCalculation, prevCalculation] = await Promise.all([
        getCalculationDao({ user_id: userId, created_at: date }),
        getCalculationDao({ user_id: userId, created_at: date - 1 })
    ]);
    const prefix = isReverse ? "reverse_" : "";
    const updatedCalculation = {
        ...currentCalculation,
        [`total_${prefix}payout_count`]: currentCalculation[`total_${prefix}payout_count`] + 1,
        [`total_${prefix}payout_amount`]: currentCalculation[`total_${prefix}payout_amount`] + amount,
        [`total_${prefix}payout_commission`]: currentCalculation[`total_${prefix}payout_commission`] + commission,
    };

    const { currentBalance, netBalance } = calculateBalances(updatedCalculation, prevCalculation, isMerchant);

    await updateCalculationDao(currentCalculation.id, {
        [`total_${prefix}payout_count`]: updatedCalculation[`total_${prefix}payout_count`],
        [`total_${prefix}payout_amount`]: updatedCalculation[`total_${prefix}payout_amount`],
        [`total_${prefix}payout_commission`]: updatedCalculation[`total_${prefix}payout_commission`],
        current_balance: currentBalance,
        net_balance: netBalance
    }, conn);
    return netBalance;
};

const processEkoPayout = async (singleWithdrawData, payload) => {
    try {
        const client_ref_id = Math.floor(Date.now() / 1000);
        const ekoResponse = await createEkoWithdraw(singleWithdrawData, client_ref_id);

        if (ekoResponse?.status === 0) {
            const isSuccess = ekoResponse?.data?.txstatus_desc?.toUpperCase() == Status.SUCCESS;
            Object.assign(payload, {
                status: isSuccess ? Status.SUCCESS : Status.REJECTED,
                approved_at: isSuccess ? new Date() : null,
                rejected_at: isSuccess ? null : new Date(),
                utr_id: ekoResponse?.data?.tid
            });
            console.info(`Payment initiated: ${ekoResponse?.message}`);
        } else {
            let getEkoPayoutStatus = null;
            if (ekoResponse.status === 1328) {
                getEkoPayoutStatus = await ekoPayoutStatus(client_ref_id);
            }
            Object.assign(payload, {
                status: Status.REJECTED,
                rejected_reason: ekoResponse?.message,
                rejected_at: new Date(),
                utr_id: getEkoPayoutStatus?.data?.tid || null
            });
            console.error(`Payment rejected by eko due to ${ekoResponse?.message}`);
        }
    } catch (error) {
        console.error('Error processing Eko method:', error);
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
            console.error(err);
            parsedData = responseText;
        }

        return parsedData;

    } catch (error) {
        console.error(error)
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
            console.error(err);
            parsedData = responseText;
        }
        return parsedData;
    } catch (error) {
        console.error(error);
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
            console.error(err);
            parsedData = responseText;
        }
        return parsedData;
    } catch (error) {
        console.error(error);
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
        console.log('Payout deleted successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
            } catch (rollbackError) {
                console.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        console.log('Error while deleting Payout', 'error', error);
        throw new BadRequestError('Error occurred while deleting Payout');
    } finally {
        if (conn) {
            try {
                conn.release(); // Release the connection back to the pool
            } catch (releaseError) {
                console.log('Error while releasing the connection', 'error', releaseError);
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
            console.error(err);
            parsedData = responseText;
        }
        return parsedData;
    } catch (error) {
        console.error(error);
    }
}

export { createPayoutService, getPayoutsService, updatePayoutService, deletePayoutService };
