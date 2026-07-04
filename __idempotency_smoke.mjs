import assert from 'node:assert';
import {
  stableStringify,
  computeRequestHash,
  resolveMerchantScope,
  idempotency,
} from './src/middlewares/idempotency.js';

// 1) stableStringify is order-independent for objects.
assert.strictEqual(
  stableStringify({ a: 1, b: 2 }),
  stableStringify({ b: 2, a: 1 }),
  'object key order must not change the canonical form',
);
assert.strictEqual(
  stableStringify({ a: { x: 1, y: 2 }, list: [1, 2] }),
  stableStringify({ list: [1, 2], a: { y: 2, x: 1 } }),
  'nested key order must not matter',
);

// 2) computeRequestHash: equal payloads -> equal hash; different -> different.
const h1 = computeRequestHash('POST', '/v2/payOut/create-payout', { amount: 100, code: 'M1' });
const h2 = computeRequestHash('POST', '/v2/payOut/create-payout', { code: 'M1', amount: 100 });
const h3 = computeRequestHash('POST', '/v2/payOut/create-payout', { amount: 999, code: 'M1' });
assert.strictEqual(h1, h2, 'same payload (any key order) -> same hash');
assert.notStrictEqual(h1, h3, 'different payload -> different hash');

// 3) resolveMerchantScope precedence.
assert.strictEqual(
  resolveMerchantScope({ merchant: { code: 'AUTHED' }, body: { code: 'BODY' } }),
  'AUTHED',
  'authenticated merchant wins',
);
assert.strictEqual(
  resolveMerchantScope({ body: { code: 'BODY' } }),
  'BODY',
  'falls back to request code',
);
assert.strictEqual(resolveMerchantScope({}), 'anonymous', 'defaults to anonymous');

// Mock res/next helpers.
const makeRes = () => ({
  req: { identifier: 'rid-1' },
  _status: undefined,
  _json: undefined,
  status(code) {
    this._status = code;
    return this;
  },
  json(body) {
    this._json = body;
    return this;
  },
});

// 4) Flag OFF -> true no-op (next called, no response written).
{
  delete process.env.IDEMPOTENCY_ENABLED;
  const res = makeRes();
  let nextCalled = false;
  await idempotency()(
    { headers: {}, method: 'POST', body: {}, query: {} },
    res,
    () => {
      nextCalled = true;
    },
  );
  assert.strictEqual(nextCalled, true, 'flag off -> next()');
  assert.strictEqual(res._json, undefined, 'flag off -> no response written');
}

// 5) Flag ON, no key, required=false -> pass through.
{
  process.env.IDEMPOTENCY_ENABLED = 'true';
  const res = makeRes();
  let nextCalled = false;
  await idempotency()(
    { headers: {}, method: 'POST', body: {}, query: {} },
    res,
    () => {
      nextCalled = true;
    },
  );
  assert.strictEqual(nextCalled, true, 'no key + optional -> next()');
  assert.strictEqual(res._json, undefined, 'no response written');
}

// 6) Flag ON, no key, required=true -> 400 v2 error, next NOT called.
{
  process.env.IDEMPOTENCY_ENABLED = 'true';
  const res = makeRes();
  let nextCalled = false;
  await idempotency({ required: true })(
    { headers: {}, method: 'POST', body: {}, query: {} },
    res,
    () => {
      nextCalled = true;
    },
  );
  assert.strictEqual(nextCalled, false, 'required + missing key -> no next()');
  assert.strictEqual(res._status, 400);
  assert.strictEqual(res._json.success, false);
  assert.strictEqual(res._json.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
}

delete process.env.IDEMPOTENCY_ENABLED;
console.log('IDEMPOTENCY_SMOKE_OK');
