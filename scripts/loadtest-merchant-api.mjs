// Load-tests all signature-required v2 merchant endpoints with per-request
// HMAC signing (write endpoints need unique order ids, so a static wrk body
// can't be used). Runs endpoints sequentially and prints a summary table.
//
// Usage: node scripts/loadtest-merchant-api.mjs
// Env: LT_PORT (8090), LT_MERCHANT_CODE (STG-rep), LT_READ_CONC (256),
//      LT_WRITE_CONC (64), LT_DURATION_S (15)
import 'dotenv/config';
import crypto from 'node:crypto';
import http from 'node:http';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import pg from 'pg';

const PORT = Number(process.env.LT_PORT || 8090);
const MERCHANT_CODE = process.env.LT_MERCHANT_CODE || 'STG-rep';
const READ_CONC = Number(process.env.LT_READ_CONC || 256);
const WRITE_CONC = Number(process.env.LT_WRITE_CONC || 64);
const DURATION_S = Number(process.env.LT_DURATION_S || 15);
const RUN_ID = Date.now().toString(36);

const db = new pg.Client({
  connectionString: process.env.DATABASE_READER_URL,
  ssl: { rejectUnauthorized: false },
});
await db.connect();
const { rows } = await db.query(
  `SELECT code, config->'keys'->>'private' AS secret
   FROM "Merchant" WHERE code = $1 AND is_obsolete = false LIMIT 1`,
  [MERCHANT_CODE],
);
const vendorRows = await db.query(`
  SELECT v.code, ba.id AS bank_id, ba.config->'keys'->>'secretKey' AS secret
  FROM "Vendor" v
  JOIN "BankAccount" ba ON ba.user_id = v.user_id AND ba.is_obsolete = false
  WHERE v.is_obsolete = false AND ba.config->'keys'->>'secretKey' IS NOT NULL
  LIMIT 1
`);
await db.end();
if (!rows.length || !rows[0].secret) {
  console.error(`Merchant ${MERCHANT_CODE} not found or has no private key`);
  process.exit(1);
}
const { code, secret } = rows[0];
const vendorAuth = vendorRows.rows[0] || null;
console.log(`Merchant: ${code}  vendor: ${vendorAuth?.code || 'n/a'}  run: ${RUN_ID}\n`);

const sign = (timestamp, payload, key = secret) =>
  crypto.createHmac('sha256', key).update(`${timestamp}${payload}`, 'utf8').digest('hex');

const agent = new http.Agent({ keepAlive: true, maxSockets: 1024 });

// Captured from create runs, reused by the status-check endpoints.
// LT_PAYIN_ORDER_ID / LT_PAYOUT_ORDER_ID pre-seed them with known real orders.
const captured = {
  payinOrderId: process.env.LT_PAYIN_ORDER_ID || null,
  payoutOrderId: process.env.LT_PAYOUT_ORDER_ID || null,
};

const fire = (endpoint, seq, capture) =>
  new Promise((resolve) => {
    const body = endpoint.buildBody ? JSON.stringify(endpoint.buildBody(seq)) : '';
    const timestamp = Date.now().toString();
    const auth = endpoint.auth || { code, secret };
    const headers = {
      'x-auth-code': auth.code,
      'x-timestamp': timestamp,
      'x-signature': sign(timestamp, body, auth.secret),
    };
    if (body) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(body);
    }

    const start = process.hrtime.bigint();
    const req = http.request(
      { agent, host: 'localhost', port: PORT, path: endpoint.path(seq), method: endpoint.method, headers },
      (res) => {
        let chunks = '';
        const wantBody = capture || (!endpoint.sampleError && res.statusCode >= 400);
        if (wantBody) res.on('data', (c) => { chunks += c; });
        else res.resume();
        res.on('end', () => {
          endpoint.latencies.push(Number(process.hrtime.bigint() - start) / 1e6);
          endpoint.statuses.set(res.statusCode, (endpoint.statuses.get(res.statusCode) || 0) + 1);
          if (wantBody && res.statusCode >= 400 && !endpoint.sampleError) {
            endpoint.sampleError = `${res.statusCode} ${chunks.slice(0, 220)}`;
          }
          if (capture && res.statusCode < 300) capture(chunks);
          resolve();
        });
      },
    );
    req.on('error', () => { endpoint.errors += 1; resolve(); });
    req.end(body);
  });

async function runEndpoint(endpoint) {
  endpoint.statuses = new Map();
  endpoint.latencies = [];
  endpoint.errors = 0;
  endpoint.sampleError = null;

  let seq = 0;
  // Warm-up + capture an order id for the status endpoints.
  await fire(endpoint, seq++, endpoint.capture);

  const deadline = Date.now() + DURATION_S * 1000;
  const startedAt = Date.now();
  const worker = async () => {
    while (Date.now() < deadline) await fire(endpoint, seq++);
  };
  await Promise.all(Array.from({ length: endpoint.concurrency }, worker));
  const elapsedS = (Date.now() - startedAt) / 1000;

  const lat = endpoint.latencies.sort((a, b) => a - b);
  const pct = (p) => lat[Math.min(lat.length - 1, Math.floor((p / 100) * lat.length))] || 0;
  const ok = [...endpoint.statuses.entries()].filter(([s]) => s < 300).reduce((a, [, c]) => a + c, 0);
  const total = lat.length;

  const statusStr = [...endpoint.statuses.entries()].sort().map(([s, c]) => `${s}:${c}`).join(' ');
  console.log(
    `${endpoint.name.padEnd(22)} ${String(Math.round(total / elapsedS)).padStart(6)} req/s  ` +
    `ok ${String(Math.round((ok / total) * 100)).padStart(3)}%  ` +
    `p50 ${pct(50).toFixed(0).padStart(5)}ms  p99 ${pct(99).toFixed(0).padStart(5)}ms  [${statusStr}]` +
    (endpoint.errors ? `  sockErr:${endpoint.errors}` : ''),
  );
  if (endpoint.sampleError) console.log(`  └─ first error: ${endpoint.sampleError}`);
}

const endpoints = [
  {
    name: 'create-payin',
    method: 'POST',
    path: () => '/v2/payIn/create-payin',
    buildBody: (seq) => ({
      userId: 'loadtest-user',
      merchantOrderId: `LOADTEST-PI-${RUN_ID}-${seq}`,
      amount: 100,
    }),
    concurrency: WRITE_CONC,
    capture: (body) => {
      if (captured.payinOrderId) return;
      try { captured.payinOrderId = JSON.parse(body)?.data?.merchantOrderId || null; } catch { /* ignore */ }
    },
  },
  {
    name: 'create (h2h)',
    method: 'POST',
    path: () => '/v2/payIn/create',
    buildBody: (seq) => ({
      userId: 'loadtest-user',
      merchantOrderId: `LOADTEST-H2H-${RUN_ID}-${seq}`,
      amount: 100,
    }),
    concurrency: WRITE_CONC,
  },
  {
    name: 'create-payout',
    method: 'POST',
    path: () => '/v2/payOut/create-payout',
    buildBody: (seq) => ({
      user: 'loadtest-user',
      ifscCode: 'HDFC0000001',
      accountHolderName: 'Load Test',
      accountNumber: '12345678901',
      bankName: 'HDFC Bank',
      amount: Number(process.env.LT_PAYOUT_AMOUNT || 500),
      merchantOrderId: `LOADTEST-PO-${RUN_ID}-${seq}`,
    }),
    concurrency: WRITE_CONC,
    capture: (body) => {
      if (captured.payoutOrderId) return;
      try { captured.payoutOrderId = JSON.parse(body)?.data?.merchantOrderId || null; } catch { /* ignore */ }
    },
  },
  {
    name: 'check-payin-status',
    method: 'POST',
    path: () => '/v2/payIn/check-payin-status',
    buildBody: () => ({ merchantOrderId: captured.payinOrderId || `LOADTEST-PI-${RUN_ID}-0` }),
    concurrency: READ_CONC,
  },
  {
    name: 'check-payout-status',
    method: 'POST',
    path: () => '/v2/payOut/check-payout-status',
    buildBody: () => ({ merchantOrderId: captured.payoutOrderId || `LOADTEST-PO-${RUN_ID}-0` }),
    concurrency: READ_CONC,
  },
  {
    name: 'wallet-balance',
    method: 'GET',
    path: () => '/v2/payOut/wallet-balance',
    buildBody: null,
    concurrency: READ_CONC,
  },
  ...(vendorAuth
    ? [
        {
          name: 'create-bot-message',
          method: 'POST',
          path: () => '/v2/bankResponse/create-bot-message',
          buildBody: (seq) => ({
            amount: 101,
            bank_id: vendorAuth.bank_id,
            utr: `LOADTEST${RUN_ID}S${seq}`,
          }),
          concurrency: READ_CONC,
          auth: vendorAuth,
        },
        {
          name: 'create-bot-msg-bulk',
          method: 'POST',
          path: () => '/v2/bankResponse/create-bot-message-bulk',
          buildBody: (seq) => ({
            body: Array.from({ length: 100 }, (_, i) => ({
              amount: 101,
              bank_id: vendorAuth.bank_id,
              utr: `LOADTEST${RUN_ID}B${seq}x${i}`,
            })),
          }),
          concurrency: WRITE_CONC,
          auth: vendorAuth,
        },
      ]
    : []),
];

const only = process.env.LT_ONLY ? process.env.LT_ONLY.split(',').map((s) => s.trim()) : null;
for (const endpoint of endpoints) {
  if (only && !only.includes(endpoint.name)) continue;
  await runEndpoint(endpoint);
}
agent.destroy();
console.log(`\ncleanup filter: merchant_order_id LIKE 'LOADTEST-%-${RUN_ID}-%'`);
