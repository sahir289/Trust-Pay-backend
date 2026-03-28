import { getBankaccountDashBoardReportDao } from '../bankAccounts/bankaccountDao.js';
import { createBankHistoryDao } from './bankHistoryDao.js';
import { logger } from '../../utils/logger.js';
import { BadRequestError } from '../../utils/appErrors.js';

export const createBankHistoryService = async (conn = null) => {
  try {
    const banks = await getBankaccountDashBoardReportDao({}, conn);
    if (!Array.isArray(banks)) {
      throw new BadRequestError(
        'Expected an array of bank accounts from getBankaccountDashBoardReportDao',
      );
    }
    const payloads = banks.map((bank) => ({
     bank_account_id: bank.id,
     today_balance: bank.today_balance || 0,
     today_current_balance: bank.balance || 0,
     count: bank.payin_count || 0,
    }));
    const results = [];
    for (const payload of payloads) {
      const created = await createBankHistoryDao(payload, conn);
      results.push(created);
    }
    return results;
  } catch (error) {
    logger.error('Error while creating bank history', error);
    throw error;
  }
};
