import { logger } from '../utils/logger.js';
import { updatePayInUrlDao } from '../apis/payIn/payInDao.js';
import { getBankaccountDao } from '../apis/bankAccounts/bankaccountDao.js';
const generateCashWalletTransactionRef = () => {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TXN${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}${randomSuffix}`;
};
export const buildCashWalletLink = ({
  payeeVpa,
  payeeName,
  amount,
  transactionRef,
  currency = 'INR',
}) => {
  const safeTransactionRef = transactionRef || generateCashWalletTransactionRef();
  const safeNote = transactionRef || safeTransactionRef;
  const safeAmount = Number(amount ?? 0).toFixed(2);
  return `upi://pay?pa=${encodeURIComponent(payeeVpa)}&pn=${encodeURIComponent(payeeName)}&tr=${encodeURIComponent(safeTransactionRef)}&tn=${encodeURIComponent(safeNote)}&am=${encodeURIComponent(safeAmount)}&cu=${encodeURIComponent(currency)}&mode=02`;
};

export const createCashWalletTransaction = async (
  providerKey,
  deposit,
  amount,
) => {
  try {
    let bankDetails = {};
    if (deposit?.bank_acc_id) {
      const [bankRecord] = await getBankaccountDao({
        id: deposit.bank_acc_id,
        company_id: deposit.company_id,
      });
      bankDetails = bankRecord || {};
    }
    const assignedBank = {
      ...bankDetails,
    };
    const payeeVpa =
      assignedBank?.is_qr === true
        ? assignedBank?.upi_id || ''
        : assignedBank?.is_bank === true
          ? assignedBank?.acc_no || assignedBank?.upi_id || ''
          : assignedBank?.upi_id || assignedBank?.acc_no || '';
    const payeeName = assignedBank?.acc_holder_name || 'Merchant';
    const currency = 'INR';
    const transactionRef = generateCashWalletTransactionRef();

    const paymentLink = buildCashWalletLink({
      payeeVpa,
      payeeName,
      amount: Number(amount ?? deposit?.amount ?? 0).toFixed(2),
      transactionRef,
      currency,
    });

     await updatePayInUrlDao(deposit.id, {
      status: 'PENDING',
      user_submitted_utr: transactionRef,
      config: { ...deposit.config, clientRefNo: transactionRef},
    });

    return { paymentLink };
  } catch (error) {
    logger.error(`Error creating ${providerKey} transaction:`, {
      error: error.response?.data || error.message || error,
    });
    throw error;
  }
};
