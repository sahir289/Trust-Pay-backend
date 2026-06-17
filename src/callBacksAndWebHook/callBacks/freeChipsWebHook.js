import crypto from 'crypto'; // Make sure this is imported at top
import { getPayoutsDao } from '../../apis/payOut/payOutDao.js';
import { Role, Status } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { _updatePayoutServiceInternal } from '../../apis/payOut/payOutService.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import config from '../../config/config.js';
import { BadRequestError } from '../../utils/appErrors.js';

export const decryptPayload = (encryptedBase64Text) => {
  try {
    const freechipsConfig = config.freechips;
    if (!freechipsConfig?.secretKeyPayout || !freechipsConfig?.secretIvPayout) {
      throw new BadRequestError('Freechips payout configuration is missing');
    }

    const secret_key = Buffer.from(freechipsConfig.secretKeyPayout, 'utf8'); 
    const iv = Buffer.from(freechipsConfig.secretIvPayout, 'utf8');

    const decipher = crypto.createDecipheriv('aes-256-cbc', secret_key, iv);
    let decrypted = decipher.update(encryptedBase64Text, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    logger.error('FreeChips decryption failed', { error: error.message });
    throw new Error('Decryption failed: ' + error.message);
  }
};

export const freeChipsSuccessCallback = async (req, res) => {
  sendSuccess(res, {}, 'FreeChips Webhook received successfully');

  let payload = req.body;
  let conn;
  let committed = false;

  try {
    if (payload?.data) {
      logger.info('Encrypted webhook payload received, decrypting...');
      payload = decryptPayload(payload.data);
    }
    logger.info('Processed FreeChips callback payload:', payload);
    const merchantOrderId = payload?.Clientransactionid || payload?.clientransactionid;
    const freeChipsStatus = payload?.Status?.toUpperCase(); 
    const utrId = payload?.UTR;
    const message = payload?.Message;

    if (!merchantOrderId) {
      logger.error('Clientransactionid missing in FreeChips webhook');
      return;
    }

    const [payout] = await getPayoutsDao({ merchant_order_id: merchantOrderId });
    if (!payout) {
      logger.error(`Payout not found for merchantOrderId: ${merchantOrderId}`);
      return;
    }

    if ([Status.REJECTED, Status.REVERSED, Status.APPROVED].includes(payout.status)) {
      logger.info(`Payout ${payout.id} already in terminal state: ${payout.status}. Ignoring.`);
      return;
    }

    const updatePayload = {};
    const adminUser = await getUserByCompanyCreatedAtDao(payout.company_id, Role.ADMIN);
    if (adminUser) updatePayload.updated_by = adminUser.id;

    if (freeChipsStatus === 'SUCCESS') {
      Object.assign(updatePayload, {
        status: Status.APPROVED,
        utr_id: utrId || null,
        approved_at: new Date().toISOString(),
      });
      logger.info(`Payout ${payout.id} marked APPROVED via FreeChips callback`);
    } 
    else if (freeChipsStatus === 'FAILED') {
      Object.assign(updatePayload, {
        status: Status.REJECTED,
        rejected_at: new Date().toISOString(),
        config: {
          ...(payout.config || {}),
          rejected_reason: message || 'Transaction Failed by FreeChips',
          provider_status: freeChipsStatus,
        }
      });
      logger.info(`Payout ${payout.id} marked REJECTED via FreeChips callback`);
    } 
    else if (freeChipsStatus === 'REFUNDED') {
      Object.assign(updatePayload, {
        status: Status.REVERSED,
        utr_id: payload?.utr_id,
        rejected_at: new Date().toISOString(),
      });
    } 
    else {
      logger.warn(`Unknown FreeChips status received: ${freeChipsStatus}`, { merchantOrderId });
      return; 
    }
    conn = await getConnection();
    await beginTransaction(conn);
    await _updatePayoutServiceInternal(
      { id: payout.id, company_id: payout.company_id },
      updatePayload,
      null,
      conn
    );
    await commit(conn);
    committed = true;
  } catch (err) {
    logger.error('Error processing FreeChips callback', err);
    if (conn && !committed) await rollback(conn);
  } finally {
    if (conn) conn.release();
  }
};