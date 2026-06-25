import { sendV2Success } from './responseHandlers.js';

// ---------------------------------------------------------------------------
// V2 response adapter
// ---------------------------------------------------------------------------
// Some endpoints (notably auth) embed security orchestration directly in the
// controller — refresh-token cookies, brute-force counters, 2FA gating — and
// only call the V1 `sendSuccess` envelope at the very end. To expose those
// endpoints under /v2 WITHOUT duplicating (and risking divergence of) that
// security logic, we let the V2 route reuse the V1 controller verbatim and
// transparently rewrite ONLY its success envelope into the V2 shape.
//
// `adaptResponseToV2` returns a Proxy over the real Express `res` that:
//   - intercepts `.status(code)` / `.json(payload)` to re-emit the V1 success
//     envelope as a V2 envelope (extracting data / message / pagination);
//   - passes EVERYTHING else (`.cookie`, `.req`, headers, etc.) straight
//     through to the real response untouched.
//
// Errors are NOT handled here: V1 controllers throw on failure, `tryCatchHandler`
// forwards via `next(error)` on the REAL `res`, and the v2ErrorHandler formats
// the V2 error envelope. The V1 controllers themselves remain byte-for-byte
// unchanged.
const adaptResponseToV2 = (res) => {
  let statusCode = 200;

  return new Proxy(res, {
    get(target, prop, receiver) {
      if (prop === 'status') {
        return (code) => {
          statusCode = code || 200;
          return receiver;
        };
      }

      if (prop === 'json') {
        return (payload) => {
          const data = payload?.data ?? {};
          const message = payload?.meta?.message ?? payload?.message ?? '';

          let pagination;
          if (
            payload &&
            (payload.total !== undefined || payload.page !== undefined)
          ) {
            pagination = { total: payload.total, page: payload.page };
          }

          // Emit on the REAL res (target) so we don't recurse through the proxy.
          return sendV2Success(target, data, message, statusCode, pagination);
        };
      }

      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
};

export { adaptResponseToV2 };
