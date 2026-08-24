// Approves LOADTEST payouts via the MANUAL method only (utr_id + bank_acc_id,
// no gateway config.method), verifies Calculation deltas, race-tests double
// approval, then REVERSES everything so staging balances net to zero.
//
// Usage: node scripts/loadtest-payout-approval.mjs
// Env: LT_APPROVE_COUNT (3)
import 'dotenv/config';
import process from 'node:process';
import { updatePayoutService } from '../src/apis/payOut/payOutService.js';
import { Role, Status } from '../src/constants/index.js';
import { executeQuery, closePool } from '../src/utils/db.js';

const APPROVE_COUNT = Number(process.env.LT_APPROVE_COUNT || 3);

const q = async (sql, params) => (await executeQuery(sql, params)).rows;

// A payout-capable bank: active, not blocked, vendor + Calculation rows exist.
const [bank] = await q(`
  SELECT ba.id AS bank_acc_id, ba.user_id AS vendor_user_id, v.id AS vendor_id,
         ba.balance, ba.today_balance, ba.payin_count
  FROM "BankAccount" ba
  JOIN "Vendor" v ON v.user_id = ba.user_id AND v.is_obsolete = false
  JOIN "Calculation" c ON c.user_id = ba.user_id
  WHERE ba.is_obsolete = false AND ba.is_enabled = true
    AND COALESCE((ba.config->>'is_blocked')::boolean, false) = false
  ORDER BY c.created_at DESC
  LIMIT 1
`);
if (!bank) {
  console.error('No usable bank found');
  process.exit(1);
}

const payouts = await q(
  `SELECT p.id, p.company_id, p.amount, p.merchant_order_id, m.user_id AS merchant_user_id
   FROM "Payout" p JOIN "Merchant" m ON m.id = p.merchant_id
   WHERE p.merchant_order_id LIKE 'LOADTEST-%' AND p.status = 'INITIATED' AND p.is_obsolete = false
   ORDER BY p.created_at ASC
   LIMIT $1`,
  [APPROVE_COUNT + 1], // +1 reserved for the race test
);
if (payouts.length < 2) {
  console.error('Not enough LOADTEST INITIATED payouts found — run the load test first');
  process.exit(1);
}
const merchantUserId = payouts[0].merchant_user_id;

const [admin] = await q(
  `SELECT u.id FROM "User" u JOIN "Designation" d ON d.id = u.designation_id
   WHERE d.designation = 'ADMIN' AND u.company_id = $1 LIMIT 1`,
  [payouts[0].company_id],
);

const snapshot = async (label) => {
  const calc = await q(
    `SELECT DISTINCT ON (user_id) user_id, net_balance, total_payout_amount, total_payout_count,
            total_reverse_payout_count
     FROM "Calculation" WHERE user_id = ANY($1) ORDER BY user_id, created_at DESC`,
    [[merchantUserId, bank.vendor_user_id]],
  );
  const [bankRow] = await q(
    `SELECT balance, today_balance, payin_count FROM "BankAccount" WHERE id = $1`,
    [bank.bank_acc_id],
  );
  console.log(`\n--- ${label} ---`);
  for (const c of calc) {
    const who = c.user_id === merchantUserId ? 'merchant' : 'vendor  ';
    console.log(`${who} net_balance=${c.net_balance} payout_amt=${c.total_payout_amount} payout_cnt=${c.total_payout_count} reverse_cnt=${c.total_reverse_payout_count}`);
  }
  console.log(`bank     balance=${bankRow.balance} today=${bankRow.today_balance} payin_count=${bankRow.payin_count}`);
  return { calc, bankRow };
};

await snapshot('BEFORE approvals');

// 1) Manual approvals (utr_id + bank_acc_id => auto-APPROVED, no gateway calls)
const toApprove = payouts.slice(0, APPROVE_COUNT);
const approved = [];
for (const p of toApprove) {
  try {
    await updatePayoutService(
      { id: p.id, company_id: p.company_id },
      { utr_id: `LTUTR${p.id.slice(0, 8)}`, bank_acc_id: bank.bank_acc_id, updated_by: admin?.id },
      Role.ADMIN,
    );
    approved.push(p);
    console.log(`approved ${p.merchant_order_id} amount=${p.amount}`);
  } catch (e) {
    console.log(`approve FAILED ${p.merchant_order_id}: ${e.message}`);
  }
}

await snapshot(`AFTER ${approved.length} manual approvals (expect merchant+vendor net_balance minus amount+commission each)`);

// 2) Race test: 5 concurrent approvals of the SAME payout — exactly 1 must win
const racer = payouts[APPROVE_COUNT];
const results = await Promise.allSettled(
  Array.from({ length: 5 }, (_, i) =>
    updatePayoutService(
      { id: racer.id, company_id: racer.company_id },
      { utr_id: `LTRACE${i}${racer.id.slice(0, 6)}`, bank_acc_id: bank.bank_acc_id, updated_by: admin?.id },
      Role.ADMIN,
    ),
  ),
);
const wins = results.filter((r) => r.status === 'fulfilled').length;
console.log(`\nRACE TEST: 5 concurrent approvals of ${racer.merchant_order_id} -> ${wins} succeeded, ${5 - wins} rejected`);
results.filter((r) => r.status === 'rejected').slice(0, 2).forEach((r) => console.log(`  rejected: ${r.reason.message}`));
if (wins === 1) approved.push(racer);

await snapshot('AFTER race test (deltas must reflect exactly ONE extra approval)');

// 3) Reverse every approval so Calculation nets back to zero
for (const p of approved) {
  try {
    await updatePayoutService(
      { id: p.id, company_id: p.company_id },
      { status: Status.REVERSED, updated_by: admin?.id },
      Role.ADMIN,
    );
    console.log(`reversed ${p.merchant_order_id}`);
  } catch (e) {
    console.log(`reverse FAILED ${p.merchant_order_id}: ${e.message}`);
  }
}

await snapshot('AFTER reversals (net_balance should be back to BEFORE; bank balance is NOT auto-restored)');

console.log(`\nbank used: ${bank.bank_acc_id} (compensate balance/today_balance/payin_count via SQL if deltas remain)`);
await closePool();
process.exit(0);
