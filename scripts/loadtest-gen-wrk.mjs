// Emits a wrk Lua script with a freshly signed request for the bot endpoint.
// Usage: node scripts/loadtest-gen-wrk.mjs > /tmp/wrk-bot.lua
import 'dotenv/config';
import crypto from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

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

const { code, bank_id, secret } = rows[0];
const body = JSON.stringify({ amount: 101, bank_id, utr: `LOADTEST${Date.now()}` });
const timestamp = Date.now().toString();
const signature = crypto
  .createHmac('sha256', secret)
  .update(`${timestamp}${body}`, 'utf8')
  .digest('hex');

process.stdout.write(`wrk.method = "POST"
wrk.body = [[${body}]]
wrk.headers["Content-Type"] = "application/json"
wrk.headers["x-auth-code"] = "${code}"
wrk.headers["x-signature"] = "${signature}"
wrk.headers["x-timestamp"] = "${timestamp}"

done = function(summary, latency, requests)
  io.write(string.format("p50=%.1fms p90=%.1fms p99=%.1fms\\n",
    latency:percentile(50)/1000, latency:percentile(90)/1000, latency:percentile(99)/1000))
end
`);
