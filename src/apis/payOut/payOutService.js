import {
    BadRequestError,
    DuplicateDataError,
} from '../../utils/appErrors.js';
import { Buffer } from 'buffer';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import Logger from '../../utils/logger.js';
import { createPayoutDao, deletePayoutDao, getPayoutsDao, updatePayoutDao } from './payOutDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getCalculationDao } from '../calculation/calculationDao.js';
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
        await beginTransaction(conn); // Start a transaction

        const data = await updatePayoutDao(id, payload); // Adjust DAO call for update

        await commit(conn); // Commit the transaction
        logger.log('Payout updated successfully', 'info');

        return data;
    } catch (error) {
        if (conn) {
            try {
                await rollback(conn); // Rollback the transaction in case of error
            } catch (rollbackError) {
                logger.log('Error during transaction rollback', 'error', rollbackError);
            }
        }
        logger.log('Error while updating Payout', 'error', error);
        throw new BadRequestError('Error occurred while updating Payout');
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
