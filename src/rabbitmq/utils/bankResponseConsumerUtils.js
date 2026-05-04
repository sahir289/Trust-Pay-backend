const bankLocks = new Map();

export function normalizeBankResponsePayload(payload) {
  return {
    payload: payload?.payload,
    x_auth_token: payload?.x_auth_token ?? payload?.company_id,
    role: payload?.role,
    name: payload?.name ?? payload?.user_name,
  };
}

export function extractBankId(payloadString = '') {
  const splitData = String(payloadString).split(' ');
  // here the 3rd index will be the bankId if the payload is in expected format
  return splitData[3] || null;
}

export async function withBankLock(bankId, work) {
  if (!bankId) {
    return work();
  }

  // Get the previous Promise in the chain for this bankId
  // If none exists, start with an already resolved Promise
  const previous = bankLocks.get(bankId) || Promise.resolve();

  // Create a new pending Promise that represents the current lock
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });

  // Chain the new Promise after the previous one
  // This ensures FIFO execution for the same bankId
  bankLocks.set(bankId, previous.then(() => current));

  // Wait until all previous operations for this bankId complete
  await previous;

  try {
    return await work();
  } finally {
    // Release the lock so the next queued operation can proceed
    release();

    // Cleanup: remove entry if no newer task has been queued
    if (bankLocks.get(bankId) === current) {
      bankLocks.delete(bankId);
    }
  }
}
