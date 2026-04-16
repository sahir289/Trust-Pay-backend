// Import required functions and classes
import crypto from 'crypto';
import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
import { getPayoutsDao } from '../../apis/payOut/payOutDao.js';
import { Role, Status } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { getCompanyByIDDao } from '../../apis/company/companyDao.js';
import { getVendorsDao } from '../../apis/vendors/vendorDao.js';
import { _updatePayoutServiceInternal } from '../../apis/payOut/payOutService.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import config from '../../config/config.js';

/**
 * Decrypt data using AES-256-CBC
 * @param {string} encryptionKey - Hex encoded encryption key
 * @param {object} encryptedObj - Object with iv and encryptedData
 * @returns {object} - Decrypted data as JSON object
 */
const decryptData = (encryptionKey, encryptedObj) => {
  const keyBuffer = Buffer.from(encryptionKey, 'hex');
  const ivBuffer = Buffer.from(encryptedObj.iv, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);

  let decrypted = decipher.update(encryptedObj.encryptedData, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');

  return JSON.parse(decrypted);
};

// Define the optimized payEasyTransactionStatusCallback function
export const payEasyTransactionStatusCallback = async (req, res) => {
  const encryptedPayload = req.body;
  let conn;
  let committed = false;
  logger.info('Received PayEasy encrypted callback payload:', { hasIv: !!encryptedPayload?.iv });
  
  try {
    // Validate encrypted payload structure
    if (!encryptedPayload?.iv || !encryptedPayload?.encryptedData) {
      logger.error('Invalid encrypted payload structure');
      return res.status(400).send('Invalid payload structure');
    }


    // Decrypt the payload
    const encryptionKey = config.payeasy.encryptionKey;
    let payload;
    try {
      payload = decryptData(encryptionKey, encryptedPayload);
      logger.info('Decrypted PayEasy callback payload:', payload);
    } catch (decryptError) {
      logger.error('Failed to decrypt PayEasy payload:', decryptError.message);
      return res.status(400).send('Failed to decrypt payload');
    }

    // Validate payload type is payout
    if (payload.type !== 'payout') {
      logger.info('Ignoring non-payout callback:', payload.type);
      return res.status(200).send('Non-payout callback ignored');
    }

    const orderId = payload?.orderId;
    if (!orderId || orderId === '') {
      return res.status(404).send('Payment not found');
    }

    conn = await getConnection();
    await beginTransaction(conn);
    const [singleWithdrawData] = await getPayoutsDao({ merchant_order_id: orderId }, conn);
    if (!singleWithdrawData) {
      await rollback(conn);
      return res.status(404).send('Payment not found');
    }

    if (
      ![Status.INITIATED, Status.PENDING].includes(singleWithdrawData.status)
    ) {
      logger.info('Payout already processed', {
        payoutId: singleWithdrawData.id,
        status: singleWithdrawData.status,
      });
      await rollback(conn);
      return res.status(200).send('Payout already processed');
    }

    logger.info('Fetched payout data for OrderID:', orderId);

    const [company] = await getCompanyByIDDao({
      id: singleWithdrawData.company_id,
    });
    logger.info(
      'Fetched company data for company_id:',
      singleWithdrawData.company_id,
    );

    // Prepare update payload based on callback response
    const bankId = company.config.PAY_EASY.defaultBankId;
    const [bankVendor] = await getBankByIdDao({ id: bankId });
    const [vendor] = await getVendorsDao({ user_id: bankVendor.user_id });
    const updatePayload = {
      bank_acc_id: bankId,
      vendor_id: vendor.id,
      config: {
        method: 'PAYEASY',
        description: 'Payout processing via PAYEASY',
      },
    };
    const adminUser = await getUserByCompanyCreatedAtDao(
      singleWithdrawData.company_id,
      Role.ADMIN,
    );
    if (adminUser) updatePayload.updated_by = adminUser.id;

    // Status mapping: 'approved' => APPROVED, 'rejected' => REJECTED, 'refunded' => REVERSED, else PENDING
    const statusStr = (payload.status || '').toString().toLowerCase();
    if (statusStr === 'approved') {
      Object.assign(updatePayload, {
        status: Status.APPROVED,
        utr_id: payload.utr || '',
        approved_at: payload.approvedAt || new Date().toISOString(),
      });
    } else if (statusStr === 'refunded') {
      updatePayload.status = Status.REVERSED;
      updatePayload.rejected_at = new Date().toISOString();
    } else if (statusStr === 'rejected') {
      updatePayload.status = Status.REJECTED;
      updatePayload.rejected_reason = 'Transaction rejected';
      updatePayload.rejected_at = new Date().toISOString();
    } else {
      updatePayload.status = Status.PENDING;
    }

    logger.info('Final update payload for payout:', updatePayload);
    await _updatePayoutServiceInternal(
      {
        id: singleWithdrawData.id,
        company_id: singleWithdrawData.company_id,
      },
      updatePayload,
      null,
      conn,
    );

    logger.info('Payout Updated by PayEasy callback', {
      status: updatePayload.status,
    });

    await commit(conn);
    committed = true;
    return res.status(200).send('Payout Updated Successfully');
  } catch (err) {
    console.log(err);
    if (conn && !committed) await rollback(conn);
    logger.error('getting error while updating payout', err);
  } finally {
    if (conn) {
      logger.info('Releasing connection');
      conn.release();
    }
  }
};
