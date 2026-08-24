// Load test for POST /v2/bankResponse/create-bot-message.
// Fetches a real vendor/bank/secret from the DB, signs one canonical body, and
// hammers the target with keep-alive connections, reporting RPS + latency.
//
// Usage: node scripts/loadtest-bot-message.mjs
// Env: LT_PORT (default 8099), LT_CONCURRENCY (default 100), LT_DURATION_S (default 15)
import 'dotenv/config';
import crypto from 'node:crypto';
import http from 'node:http';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import pg from 'pg';

const PORT = Number(process.env.LT_PORT || 8099);
const CONCURRENCY = Number(process.env.LT_CONCURRENCY || 100);
const DURATION_S = Number(process.env.LT_DURATION_S || 15);

const db = new pg.Client({
  connectionString: process.env.DATABASE_READER_URL,
  ssl: { rejectUnauthorized: false },
});
await db.connect();
const { rows } = await db.query(`
  SELECT v.code, ba.id AS bank_id, ba.config->'keys'->>'secretKey' AS secret
  FROM "Vendor" v
  JOIN "BankAccount" ba ON ba.user_id = v.user_id AND ba.is_obsolete = false
  WHERE v.is_obsolete = false AND ba.config->'keys'->>'secretKey' IS NOT NULL
  LIMIT 1
`);
await db.end();

if (!rows.length) {
  console.error('No vendor with a signed bank account found');
  process.exit(1);
}
const { code, bank_id, secret } = rows[0];
console.log(`Vendor: ${code}, bank: ${bank_id}`);

const body = JSON.stringify({
  amount: 101,
  bank_id,
  utr: `LOADTEST${Date.now()}`,
});
const timestamp = Date.now().toString();
const signature = crypto
  .createHmac('sha256', secret)
  .update(`${timestamp}${body}`, 'utf8')
  .digest('hex');

const headers = {
  'content-type': 'application/json',
  'content-length': Buffer.byteLength(body),
  'x-auth-code': code,
  'x-signature': signature,
  'x-timestamp': timestamp,
};

const agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY });
const statuses = new Map();
const latencies = [];
let socketErrors = 0;
let lastError = null;
let lastBody = null;
let captureBody = false;

const fire = () =>
  new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const req = http.request(
      {
        agent,
        host: 'localhost',
        port: PORT,
        path: '/v2/bankResponse/create-bot-message',
        method: 'POST',
        headers,
      },
      (res) => {
        if (captureBody) {
          let chunks = '';
          res.on('data', (c) => { chunks += c; });
          res.on('end', () => { lastBody = chunks; });
        } else {
          res.resume();
        }
        res.on('end', () => {
          latencies.push(Number(process.hrtime.bigint() - start) / 1e6);
          statuses.set(res.statusCode, (statuses.get(res.statusCode) || 0) + 1);
          resolve();
        });
      },
    );
    req.on('error', (err) => {
      lastError = err;
      socketErrors += 1;
      resolve();
    });
    req.end(body);
  });

// Single warm-up request so cold caches don't skew stats, and to fail fast.
captureBody = true;
await fire();
captureBody = false;
const warmupStatus = [...statuses.keys()][0];
console.log(`Warm-up status: ${warmupStatus}`);
if (warmupStatus !== 200) {
  console.error('Warm-up did not return 200, aborting');
  if (lastError) console.error('socket error:', lastError.message);
  if (lastBody) console.error('response body:', lastBody.slice(0, 500));
  process.exit(1);
}
statuses.clear();
latencies.length = 0;

console.log(`Running: ${CONCURRENCY} connections for ${DURATION_S}s ...`);
const deadline = Date.now() + DURATION_S * 1000;
const startedAt = Date.now();
const worker = async () => {
  while (Date.now() < deadline) {
    await fire();
  }
};
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const elapsedS = (Date.now() - startedAt) / 1000;

latencies.sort((a, b) => a - b);
const pct = (p) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))];
const total = latencies.length;

console.log('--- results ---');
console.log(`total requests : ${total}`);
console.log(`throughput     : ${(total / elapsedS).toFixed(0)} req/s`);
console.log(`socket errors  : ${socketErrors}`);
for (const [status, count] of [...statuses.entries()].sort()) {
  console.log(`status ${status}     : ${count}`);
}
if (total) {
  console.log(`latency p50    : ${pct(50).toFixed(1)} ms`);
  console.log(`latency p90    : ${pct(90).toFixed(1)} ms`);
  console.log(`latency p99    : ${pct(99).toFixed(1)} ms`);
  console.log(`latency max    : ${latencies.at(-1).toFixed(1)} ms`);
}
agent.destroy();
