// Central guard that guarantees credentials/secrets never leave over a socket.
// Applied at the emit chokepoint so no producer can accidentally expose them.
const SENSITIVE_KEYS = new Set([
  'privatekey',
  'privatekeys',
  'publickey',
  'secretkey',
  'secretaccesskey',
  'accesskey',
  'apikey',
  'xapikey',
  'apisecret',
  'clientsecret',
  'private',
  'public',
  'secret',
  'keys',
  'password',
  'passwd',
  'pwd',
  'token',
  'jwt',
  'accesstoken',
  'refreshtoken',
  'credentials',
  'authorization',
  'cookie',
  'twofactorsecret',
  'totpsecret',
]);

const normalizeKey = (key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');

const isSensitiveKey = (key) => SENSITIVE_KEYS.has(normalizeKey(key));

// Deep-clones the payload and drops any sensitive keys at any nesting level.
// Does not mutate the original object (callers may reuse it, e.g. DB rows).
const sanitizeSocketPayload = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizeSocketPayload);
  }

  if (value && typeof value === 'object') {
    if (value instanceof Date) {
      return value;
    }

    const clean = {};
    for (const [key, nested] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        continue;
      }
      clean[key] = sanitizeSocketPayload(nested);
    }
    return clean;
  }

  return value;
};

export { isSensitiveKey, sanitizeSocketPayload };
