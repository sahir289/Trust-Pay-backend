import dotenv from 'dotenv';
import getGeoGuardConfig from './geoGuard.js';
dotenv.config({ path: '.env' });

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const withLegacy = (env, primary, legacy, fallback) =>
  parsePositiveInt(env?.[primary] || env?.[legacy], fallback);

// Env file configuration
function config(Env) {
  return {
    env: Env?.NODE_ENV,
    port: Env?.PORT,
    app: {
      testingIp: Env?.LOCAL_IP,
    },
    aws: {
      region: Env?.AWS_REGION || 'us-east-1',
      accessKeyId: Env?.AWS_ACCESS_KEY_ID,
      secretAccessKey: Env?.AWS_SECRET_ACCESS_KEY,
      cloudWatchLogGroup: Env?.AWS_LOG_GROUP_NAME,
    },
    jwt: {
      jwt_secret: Env?.JWT_SECRET,
      jwt_expires_in: Env?.JWT_EXPIRES_IN || '5m',
      refresh_token_secret: Env?.REFRESH_TOKEN_SECRET,
      refresh_token_expires_in: Env?.REFRESH_TOKEN_EXPIRES_IN || '12h',
      temp_token: Env?.TEMP_TOKEN,
      temp_token_expires: Env?.TEMP_TOKEN_EXPIRES,
    },
    rabbitmq : {
      url: Env?.RABBITMQ_URL || 'amqp://localhost:5672',
      connectionTimeout: parseInt(Env?.RABBITMQ_CONNECTION_TIMEOUT) || 10000, // in milliseconds
      heartbeat: parseInt(Env?.RABBITMQ_HEARTBEAT) || 60,
      reconnectBaseDelayMs: parseInt(Env?.RABBITMQ_RECONNECT_BASE_DELAY_MS) || 1000,
      maxReconnectDelayMs: parseInt(Env?.RABBITMQ_MAX_RECONNECT_DELAY_MS) || 30000,
      producerRetryAttempts: parseInt(Env?.RABBITMQ_PRODUCER_RETRY_ATTEMPTS) || 3,
      producerRetryDelayMs: parseInt(Env?.RABBITMQ_PRODUCER_RETRY_DELAY_MS) || 500,
      bankResponseQueue: Env?.RABBITMQ_BANK_RESPONSE_QUEUE || 'bank_response_queue',
      bankResponseBotBulkQueue: Env?.RABBITMQ_BANK_RESPONSE_BOT_BULK_QUEUE || 'bank_response_bot_bulk_queue',
      bulkPayoutQueue: Env?.RABBITMQ_BULK_PAYOUT_QUEUE || 'bulk_payout_queue',
    },
    telegram: {
      telegram_url: Env?.TELEGRAM_URL,
      bankAlertCooldownSec: parsePositiveInt(
        Env?.TELEGRAM_BANK_ALERT_COOLDOWN_SEC,
        60,
      ),
    },
    ocr: {
      url: Env?.OCR_URL,
      payoutUrl: Env?.OCR_PAYOUT_URL,
      timeoutMs: Number(Env?.OCR_TIMEOUT_MS) || 15000,
    },
    redis: {
      url: Env?.REDIS_URL || 'redis://localhost:6379',
    },
    paymentPage: {
      signingSecret: Env?.MERCHANT_SIGNING_SECRET,
    },
    rateLimiter: {
      points: parsePositiveInt(Env?.RATE_LIMIT_POINTS, 300),
      duration: parsePositiveInt(Env?.RATE_LIMIT_DURATION, 60),
      blockDuration: parsePositiveInt(Env?.RATE_LIMIT_BLOCK_DURATION, 30),
      profiles: {
        auth: {
          points: parsePositiveInt(Env?.RATE_LIMIT_AUTH_POINTS, 120),
          duration: parsePositiveInt(Env?.RATE_LIMIT_AUTH_DURATION, 60),
          blockDuration: parsePositiveInt(
            Env?.RATE_LIMIT_AUTH_BLOCK_DURATION,
            60,
          ),
        },
        read: {
          points: parsePositiveInt(Env?.RATE_LIMIT_READ_POINTS, 1200),
          duration: parsePositiveInt(Env?.RATE_LIMIT_READ_DURATION, 60),
          blockDuration: parsePositiveInt(
            Env?.RATE_LIMIT_READ_BLOCK_DURATION,
            20,
          ),
        },
        write: {
          points: parsePositiveInt(Env?.RATE_LIMIT_WRITE_POINTS, 300),
          duration: parsePositiveInt(Env?.RATE_LIMIT_WRITE_DURATION, 60),
          blockDuration: parsePositiveInt(
            Env?.RATE_LIMIT_WRITE_BLOCK_DURATION,
            30,
          ),
        },
        merchantIntegration: {
          points: parsePositiveInt(
            Env?.RATE_LIMIT_MERCHANT_INTEGRATION_POINTS,
            200,
          ),
          duration: parsePositiveInt(
            Env?.RATE_LIMIT_MERCHANT_INTEGRATION_DURATION,
            60,
          ),
          blockDuration: parsePositiveInt(
            Env?.RATE_LIMIT_MERCHANT_INTEGRATION_BLOCK_DURATION,
            20,
          ),
        },
        bankResponse: {
          points: parsePositiveInt(Env?.RATE_LIMIT_BANK_POINTS, 300),
          duration: parsePositiveInt(Env?.RATE_LIMIT_BANK_DURATION, 60),
          blockDuration: parsePositiveInt(
            Env?.RATE_LIMIT_BANK_BLOCK_DURATION,
            30,
          ),
        },
      },
    },
    elasticSearch: {
      node: Env?.ELASTICSEARCH_NODE || 'http://localhost:9200',
      username: Env?.ELASTICSEARCH_USERNAME || 'elastic',
      password: Env?.ELASTICSEARCH_PASSWORD || 'password',
      indexPrefix: Env?.ELASTICSEARCH_INDEX_PREFIX || 'trustpay',
      requestTimeout: parseInt(Env?.ELASTICSEARCH_REQUEST_TIMEOUT) || 30000, // in milliseconds
      maxRetries: parseInt(Env?.ELASTICSEARCH_MAX_RETRIES) || 3,
    },
    cashfree: {
      clientIdTest: Env?.CLIENT_ID_TEST,
      clientSecretTest: Env?.CLIENT_SECRET_TEST,
      clientIdProd: Env?.CLIENT_ID_PROD,
      clientSecretProd: Env?.CLIENT_SECRET_PROD,
    },
    zentechind: {
      url: Env?.ZENTECHIND_API_URL,
      salt: Env?.ZENTECHIND_SALT,
      collectionId: Env?.ZENTECHIND_COLLECTION_ID,
    },
    silkPay: {
      url: Env?.SILK_PAY_API_URL,
      initiatePayout: Env?.SILK_PAY_INITIATE_API_URL,
      walletBalance: Env?.SILK_PAY_WALLET_BALANCE_API_URL,
      secret: Env?.SILK_PAY_SECRET,
      collectionId: Env?.SILK_PAY_COLLECTION_ID,
      silkPayMerchant: Env?.SILK_PAY_MERCHANT_ID,
      silkPayCallbackUrl: Env?.SILK_PAY_CALLBACK_URL,
      silkPayPayoutCallbackUrl: Env?.SILK_PAY_PAYOUT_CALLBACK_URL
    },
    nmplPay: {
      url: Env?.NMPL_PAY_API_URL,
      salt: Env?.NMPL_PAY_SALT,
      collectionId: Env?.NMPL_PAY_COLLECTION_ID,
      tickSalt: Env?.NMPL_PAY_TICK_SALT,
      tickCollectionId: Env?.NMPL_PAY_TICK_COLLECTION_ID,
      nmplPaySpecialMerchant: Env?.SPECIAL_NMPL_PAY_MERCHANT,
      nmplPaySpecialMerchant2: Env?.SPECIAL_NMPL_PAY_MERCHANT2,
    },
    runsafe: {
      url: Env?.RUNSAFE_API_URL,
      baseUrl: Env?.RUNSAFE_BASE_API_URL,
      initiatePayout: Env?.RUNSAFE_INITIATE_API_URL,
      walletBalance: Env?.RUNSAFE_WALLET_BALANCE_API_URL,
      NotifyUrl: Env?.RUNSAFE_NOTIFY_URL,
      payoutNotifyUrl: Env?.RUNSAFE_PAYOUT_NOTIFY_URL,
      privateKey: Env?.RUNSAFE_PRIVATE_KEY,
      publicKey: Env?.RUNSAFE_PUBLIC_KEY,
      mchId: Env?.RUNSAFE_MCH_ID,
      appId: Env?.RUNSAFE_APP_ID,
    },
    cps: {
      url: Env?.CPS_API_URL,
      NotifyUrl: Env?.CPS_NOTIFY_URL,
      privateKey: Env?.CPS_PRIVATE_KEY,
      publicKey: Env?.CPS_PUBLIC_KEY,
    },
    tytl : {
      apiKey: Env.TYTL_API_KEY,
      secretKey: Env.TTYL_SECRET_KEY,
      NotifyUrl: Env?.TYTL_NOTIFY_URL,
      payinUrl : Env?.TYTL_PAYIN_URL,
    },
    vertexPay:{
      url: Env?.VERTEX_API_PAYIN_UPI_INTENT_URL,
      apiKey: Env?.VERTEX_API_KEY,
    },
    clickrr : {
      baseUrl: Env?.CLICKRR_BASE_API_URL,
      initiatePayout: Env?.CLICKRR_INITIATE_API_URL,
      walletBalance: Env?.CLICKRR_WALLET_BALANCE_API_URL,
      apiKey: Env?.CLICKRR_API_KEY,
      apiSecret: Env?.CLICKRR_API_SECRET,
    },
    payAssist : {
      baseUrl: Env?.PAY_ASSIST_API_URL,
    },
    payDum : {
      baseUrl: Env?.PAY_DUM_API_URL,
    },
    tataPay : {
      baseUrl: Env?.TATA_PAY_BASE_API_URL,
      bulkUrl: Env?.TATA_PAY_BULK_API_URL,
    },
    rupeeFlow : {
      baseUrl: Env?.RUPEE_FLOW_BASE_API_URL,
    },
    bss : {
      baseUrl: Env?.BSS_BASE_API_URL,
      initiatePayout: Env?.BSS_WALLET_BALANCE_API_URL,
      walletBalance: Env?.BSS_WALLET_BALANCE_API_URL,
      apiKey: Env?.BSS_API_KEY,
      apiSecret: Env?.BSS_API_SECRET,
    },
    bss02 : {
      baseUrl: Env?.BSS_BASE_API_URL,
      initiatePayout: Env?.BSS_WALLET_BALANCE_API_URL,
      walletBalance: Env?.BSS_WALLET_BALANCE_API_URL,
      apiKey: Env?.BSS02_API_KEY,
      apiSecret: Env?.BSS02_API_SECRET,
    },
    bss03 : {
      baseUrl: Env?.BSS_BASE_API_URL,
      initiatePayout: Env?.BSS_WALLET_BALANCE_API_URL,
      walletBalance: Env?.BSS_WALLET_BALANCE_API_URL,
      apiKey: Env?.BSS03_API_KEY,
      apiSecret: Env?.BSS03_API_SECRET,
    },
    albeCollect: {
      url: Env?.ALBE_COLLECT_API_URL,
      mid: Env?.ALBE_COLLECT_MID,
      secretKey: Env?.ALBE_COLLECT_SECRET_KEY,
    },
    freechips: {
      payin_url: Env?.FREECHIPS_PAYIN_URL,
      secretKey: Env?.FREECHIPS_SECRET_KEY,
      secretIv: Env?.FREECHIPS_SECRET_IV,
      secretIvPayout : Env?.FREECHIPS_PAYOUT_SECRET_IV,
      secretKeyPayout : Env?.FREECHIPS_PAYOUY_SECRET_KEY,
      secretCodePayout : Env?.FREECHIPS_PAYOUY_SECRET_CODE,
      secretVendorKeyPayout : Env?.FREECHIPS_PAYOUY_VENDOR_KEY,
      baseUrl : Env?.FREECHIPS_URL,
      tpin : Env?.FREECHIPS_TPIN || 654321,
    },
    payfly: {
      baseUrl: Env?.PAYFLY_BASE_URL,
    },
    pennyPay: {
      payoutUrl: Env?.PENNY_PAY_PAYOUT_URL,
      payinUrl: Env?.PENNY_PAY_PAYIN_URL,
      walletBalanceUrl: Env?.PENNY_PAY_WALLET_BALANCE_URL,
    },
    trustPay: {
      payoutUrl: Env?.TRUST_PAY_PAYOUT_URL,
      payinUrl: Env?.TRUST_PAY_PAYIN_URL,
      walletBalanceUrl: Env?.TRUST_PAY_WALLET_BALANCE_URL,
    },
    payBitra: {
      payoutUrl: Env?.PAY_BITRA_PAYOUT_URL,
      payinUrl: Env?.PAY_BITRA_PAYIN_URL,
      walletBalanceUrl: Env?.PAY_BITRA_WALLET_BALANCE_URL,
    },
    payCric: {
      payoutUrl: Env?.PAY_CRIC_PAYOUT_URL,
      payinUrl: Env?.PAY_CRIC_PAYIN_URL,
      walletBalanceUrl: Env?.PAY_CRIC_WALLET_BALANCE_URL,
    },
    controllerCacheTtls: {
      auth: {
        session: parsePositiveInt(Env?.AUTH_SESSION_CACHE_TTL_SEC, 30),
      },
      roles: parsePositiveInt(Env?.ROLES_CACHE_TTL_SEC, 12 * 60 * 60),
      designations: parsePositiveInt(
        Env?.DESIGNATIONS_CACHE_TTL_SEC,
        12 * 60 * 60,
      ),
      payin: {
        search: withLegacy(
          Env,
          'PAYIN_SEARCH_CACHE_TTL_SEC',
          'PAYIN_CACHE_TTL_SEC',
          20,
        ),
        summary: withLegacy(
          Env,
          'PAYIN_SUMMARY_CACHE_TTL_SEC',
          'PAYIN_CACHE_TTL_SEC',
          10,
        ),
        count: parsePositiveInt(Env?.PAYIN_COUNT_CACHE_TTL_SEC, 60),
        validateMerchant: parsePositiveInt(
          Env?.PAYIN_VALIDATE_MERCHANT_CACHE_TTL_SEC,
          20,
        ),
        validateBank: parsePositiveInt(
          Env?.PAYIN_VALIDATE_BANK_CACHE_TTL_SEC,
          10,
        ),
        validateVendor: parsePositiveInt(
          Env?.PAYIN_VALIDATE_VENDOR_CACHE_TTL_SEC,
          60,
        ),
        routing: parsePositiveInt(Env?.PAYIN_ROUTING_CACHE_TTL_SEC, 60),
        processInflight: parsePositiveInt(
          Env?.PAYIN_IDEMPOTENCY_INFLIGHT_TTL_SEC,
          60,
        ),
        depositStatusCooldown: parsePositiveInt(
          Env?.PAYIN_DEPOSIT_STATUS_COOLDOWN_SEC,
          3,
        ),
      },
      payout: {
        createInflight: parsePositiveInt(
          Env?.PAYOUT_CREATE_INFLIGHT_TTL_SEC,
          5,
        ),
        byId: withLegacy(
          Env,
          'PAYOUT_BY_ID_CACHE_TTL_SEC',
          'PAYOUT_CACHE_TTL_SEC',
          15,
        ),
        list: withLegacy(
          Env,
          'PAYOUT_LIST_CACHE_TTL_SEC',
          'PAYOUT_CACHE_TTL_SEC',
          20,
        ),
        search: withLegacy(
          Env,
          'PAYOUT_SEARCH_CACHE_TTL_SEC',
          'PAYOUT_CACHE_TTL_SEC',
          20,
        ),
      },
      bankAccounts: {
        byId: parsePositiveInt(Env?.BANK_ACCOUNTS_BY_ID_CACHE_TTL_SEC, 15),
        list: parsePositiveInt(Env?.BANK_ACCOUNTS_LIST_CACHE_TTL_SEC, 20),
        search: parsePositiveInt(Env?.BANK_ACCOUNTS_SEARCH_CACHE_TTL_SEC, 20),
        merchantBank: parsePositiveInt(
          Env?.BANK_ACCOUNTS_MERCHANT_BANK_CACHE_TTL_SEC,
          20,
        ),
      },
      users: {
        byId: parsePositiveInt(Env?.USER_BY_ID_CACHE_TTL_SEC, 15),
        list: parsePositiveInt(Env?.USERS_LIST_CACHE_TTL_SEC, 20),
        search: parsePositiveInt(Env?.USERS_SEARCH_CACHE_TTL_SEC, 20),
        byUsername: parsePositiveInt(Env?.USERS_BY_USERNAME_CACHE_TTL_SEC, 15),
      },
      merchants: {
        byId: parsePositiveInt(Env?.MERCHANT_BY_ID_CACHE_TTL_SEC, 15),
        byCode: parsePositiveInt(Env?.MERCHANT_BY_CODE_CACHE_TTL_SEC, 20),
        list: parsePositiveInt(Env?.MERCHANTS_LIST_CACHE_TTL_SEC, 20),
        search: parsePositiveInt(Env?.MERCHANTS_SEARCH_CACHE_TTL_SEC, 20),
        codes: parsePositiveInt(Env?.MERCHANT_CODES_CACHE_TTL_SEC, 30),
      },
      vendors: {
        byId: parsePositiveInt(Env?.VENDOR_BY_ID_CACHE_TTL_SEC, 15),
        byCode: parsePositiveInt(Env?.VENDOR_BY_CODE_CACHE_TTL_SEC, 20),
        list: parsePositiveInt(Env?.VENDORS_LIST_CACHE_TTL_SEC, 20),
        search: parsePositiveInt(Env?.VENDORS_SEARCH_CACHE_TTL_SEC, 20),
        codes: parsePositiveInt(Env?.VENDOR_CODES_CACHE_TTL_SEC, 30),
      },
      settlement: {
        createInflight: parsePositiveInt(
          Env?.SETTLEMENT_CREATE_INFLIGHT_TTL_SEC,
          5,
        ),
        byId: parsePositiveInt(Env?.SETTLEMENT_BY_ID_CACHE_TTL_SEC, 15),
        list: parsePositiveInt(Env?.SETTLEMENT_LIST_CACHE_TTL_SEC, 20),
        search: parsePositiveInt(Env?.SETTLEMENT_SEARCH_CACHE_TTL_SEC, 20),
      },
      userHierarchy: {
        lookup: parsePositiveInt(Env?.USER_HIERARCHY_CACHE_TTL_SEC, 60),
        byId: parsePositiveInt(Env?.USER_HIERARCHY_BY_ID_CACHE_TTL_SEC, 15),
        list: parsePositiveInt(Env?.USER_HIERARCHY_LIST_CACHE_TTL_SEC, 20),
      },
      beneficiary: {
        byId: parsePositiveInt(Env?.BENEFICIARY_BY_ID_CACHE_TTL_SEC, 15),
        list: parsePositiveInt(Env?.BENEFICIARY_LIST_CACHE_TTL_SEC, 20),
        search: parsePositiveInt(Env?.BENEFICIARY_SEARCH_CACHE_TTL_SEC, 20),
        byBankName: parsePositiveInt(
          Env?.BENEFICIARY_BY_BANKNAME_CACHE_TTL_SEC,
          20,
        ),
      },
      calculation: {
        byId: parsePositiveInt(Env?.CALCULATION_BY_ID_CACHE_TTL_SEC, 15),
        list: parsePositiveInt(Env?.CALCULATION_LIST_CACHE_TTL_SEC, 20),
      },
      reports: {
        payin: parsePositiveInt(Env?.REPORTS_PAYIN_CACHE_TTL_SEC, 30),
        payout: parsePositiveInt(Env?.REPORTS_PAYOUT_CACHE_TTL_SEC, 30),
        accounts: parsePositiveInt(Env?.REPORTS_ACCOUNTS_CACHE_TTL_SEC, 30),
      },
    },
    orvixPay: {
      url: Env?.ORVIX_PAY_API_URL,
      salt: Env?.ORVIX_PAY_SALT,
      collectionId: Env?.ORVIX_PAY_COLLECTION_ID,
    },
     orvixPay1: {
      url: Env?.ORVIX_PAY_API_URL,
      salt: Env?.ORVIX_PAY_SALT_1,
      collectionId: Env?.ORVIX_PAY_COLLECTION_ID_1,
    },
    openStreetApi:{
      openStreetMapUrl: Env?.OPEN_STREET_MAP_URL,
      openStreetMapExtraParams :Env?.OPEN_STREET_MAP_EXTRA_PARAMS
    },
    proxyCheck: {
      proxyCheckUrl: Env?.PROXY_CHECK_URL,
    },
    // Internal IP Intelligence Service (IPIS). Caches proxycheck.io lookups
    // (Redis L2 -> Postgres L3) so the vendor is called only on a cold miss
    // instead of on every request.
    // See docs/architecture/ip-intelligence-service-design.md.
    ipIntelligence: {
      cacheKeyVersion: Env?.IP_INTEL_CACHE_VERSION || 'v1',
      ttls: {
        blockSec: parsePositiveInt(Env?.IP_INTEL_TTL_BLOCK_SEC, 86400),
        cleanSec: parsePositiveInt(Env?.IP_INTEL_TTL_CLEAN_SEC, 21600),
        lowConfidenceSec: parsePositiveInt(Env?.IP_INTEL_TTL_LOW_CONF_SEC, 1800),
        negativeSec: parsePositiveInt(Env?.IP_INTEL_TTL_NEGATIVE_SEC, 180),
      },
      provider: {
        timeoutMs: parsePositiveInt(Env?.IP_INTEL_PROVIDER_TIMEOUT_MS, 2500),
        breakerFailureThreshold: parsePositiveInt(Env?.IP_INTEL_BREAKER_FAILS, 5),
        breakerCooldownMs: parsePositiveInt(
          Env?.IP_INTEL_BREAKER_COOLDOWN_MS,
          30000,
        ),
      },
      // Auto-learning: when a live (cold) provider lookup returns a confident
      // "bad" verdict (VPN/proxy/TOR/datacenter), remember that IP as a range in "IpFeedRange" so future requests are blocked for free straight from our DB — without re-paying the provider once the per-IP cache expires.
      // The confidence gate + a self-expiring TTL keep occasional provider mistakes from turning into permanent blocks (they heal on their own).
      feedPromotion: {
        enabled: Env?.IP_INTEL_FEED_PROMOTION_ENABLED !== 'false', // default ON
        minConfidence:
          Number(Env?.IP_INTEL_FEED_PROMOTION_MIN_CONFIDENCE) || 0.9,
        ttlDays: parsePositiveInt(Env?.IP_INTEL_FEED_PROMOTION_TTL_DAYS, 30),
      },
    },
    payeasy: {
      url: Env?.PAYEASY_API_URL,
      payeasyClientId: Env?.PAYEASY_CLIENT_ID,
      encryptionKey: Env?.PAYEASY_ENCRYPTION_KEY
    },
    payeasy02: {
      url: Env?.PAYEASY02_API_URL,
      payeasyClientId: Env?.PAYEASY02_CLIENT_ID,
      encryptionKey: Env?.PAYEASY02_ENCRYPTION_KEY
    },
    payeasy03: {
      url: Env?.PAYEASY03_API_URL,
      payeasyClientId: Env?.PAYEASY03_CLIENT_ID,
      encryptionKey: Env?.PAYEASY03_ENCRYPTION_KEY
    },
    // reactAppBaseUrl: Env?.REACT_APP_BASE_URL,
    databaseUrl: Env?.DATABASE_URL,
    databaseWriterUrl: Env?.DATABASE_WRITER_URL,
    databaseReaderUrl: Env?.DATABASE_READER_URL,
    // Optional: comma-separated list of postgresql reader *instance* endpoints
    // (e.g. "postgresql://...instance-2...,postgresql://...instance-3...").
    // When provided, the app round-robins SELECTs across each endpoint to
    // avoid pinning all reader traffic to a single PostgreSQL reader instance.
    // Falls back to databaseReaderUrl when unset.
    databaseReaderUrls: (Env?.DATABASE_READER_URLS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    // When 'true'/'1'/'yes', the app runs behind RDS Proxy / PgBouncer in
    // transaction-pooling mode. The DB layer then uses small per-process pools
    // and applies session settings via connection startup options instead of
    // post-connect `SET` statements (which would pin a proxied connection to one
    // client and defeat multiplexing). Default false => direct connection.
    dbBehindProxy: ['true', '1', 'yes'].includes(
      String(Env?.DB_BEHIND_PROXY || '').toLowerCase(),
    ),
    accessTokenSecretKey: Env?.ACCESS_TOKEN_SECRET_KEY,
    accessTokenExpireTime: 24 * 60 * 60, // in seconds
    reactFrontOrigin1: Env?.REACT_FRONT_ORIGIN_1,
    reactFrontOrigin2: Env?.REACT_FRONT_ORIGIN_2,
    LOGIN_BLOCK_ORIGIN: Env?.LOGIN_BLOCK_ORIGIN,
    reactPaymentOrigin: Env?.REACT_PAYMENT_ORIGIN,
    ocrPrivateKey: Env?.OCR_PRIVATE_KEY,
    clientEmail: Env?.CLIENT_EMAIL,
    bucketName: Env?.BUCKET_NAME,
    bucketRegion: Env?.BUCKET_REGION,
    accessKeyS3: Env?.ACCESS_KEY,
    secretKeyS3: Env?.SECRET_ACCESS_KEY,
    telegramRatioAlertsChatIdUpdatedData: Env?.TELEGRAM_RATIO_ALERTS_CHAT_ID_UPDATED_DATA,
    telegramBotToken: Env?.TELEGRAM_BOT_TOKEN,
    telegramAlertsBotToken: Env?.TELEGRAM_ALERTS_BOT_TOKEN, // currently not in use
    telegramRatioAlertsChatId: Env?.TELEGRAM_RATIO_ALERTS_CHAT_ID,
    telegramDashboardChatId: Env?.TELEGRAM_DASHBOARD_CHAT_ID,
    telegramBankAlertChatId: Env?.TELEGRAM_BANK_ALERT_CHAT_ID,
    telegramDuplicateDisputeChatId: Env?.TELEGRAM_DISPUTE_DUPLICATE_CHAT_ID,
    telegramCheckUTRHistoryChatId: Env?.TELEGRAM_CHECK_UTR_HISTORY_CHAT_ID,
    telegramStatementNotUploadNotificationChatId: Env?.TELEGRAM_STATEMENT_NOT_UPLOAD_NOTIFICATION_CHAT_ID,
    telegramOcrBotToken: Env?.TELEGRAM_OCR_BOT_TOKEN,
    telegramCheckUtrBotToken: Env?.TELEGRAM_CHECK_UTR_BOT_TOKEN,
    ekoPaymentsActivateUrl: Env?.EKO_PAYMENTS_ACTIVATE_URL,
    ekoPaymentsInitiateUrl: Env?.EKO_PAYMENTS_INITIATE_URL,
    ekoPaymentsStatusUrl: Env?.EKO_PAYMENTS_STATUS_URL,
    ekoWalletBalanceEnquiryUrl: Env?.EKO_WALLET_BALANCE_INQUIRY_URL,
    ekoRegisteredMobileNo: Env?.EKO_REGISTERED_MOBILE_NO,
    ekoAccessKey: Env?.EKO_ACCESS_AUTHENTICATOR_KEY,
    ekoServiceCode: Env?.EKO_SERVICE_CODE,
    ekoUserCode: Env?.EKO_USER_CODE,
    ekoInitiatorId: Env?.EKO_INITIATOR_ID,
    ekoDeveloperKey: Env?.EKO_DEVELOPER_KEY,
    ipInfoApiKey: Env?.IP_INFO_API_KEY,
    latitudeBlock: Env?.BLOCK_LAT,
    longitudeBlock: Env?.BLOCK_LONG,
    nodeProductionLogs: Env?.NODE_ENV,
    cashFreeCreateOrderUrl: Env?.CREATE_ORDER_URL,
    key_id: Env?.RAZOR_PAY_ID,
    key_secret: Env?.RAZOR_PAY_SECRET,
    cashFreeClientSecret: Env?.CLIENT_SECRET,
    cashFreeClientId: Env?.CLIENT_ID,
    telegramVendorboardChatId: Env?.TELEGRAM_VENDORBOARD_CHAT_ID,
    ipWhitelists: {
      payin: Env?.PAYIN_WHITELIST_IPS ,
      payout: Env?.PAYOUT_WHITELIST_IPS ,
      localIp: Env?.LOCAL_IP ,
    },
    // Interface the HTTP server binds to. Leave empty to bind all interfaces
    // (current behaviour). Set to 127.0.0.1 when nginx runs on the same host so
    // the app port is unreachable from off-box; use a firewall/security group
    // instead when nginx is on a separate host.
    bindHost: Env?.BIND_HOST || '',
    // Edge guard: proves a request transited nginx via a shared secret header.
    // mode: 'off' | 'monitor' (log-only) | 'enforce' (403 on violation).
    // Defaults to monitor in production (zero blocking) and off elsewhere so
    // enabling it never breaks a running deployment until an operator opts in.
    edgeGuard: {
      mode: (
        Env?.EDGE_GUARD_MODE ||
        (Env?.NODE_ENV === 'production' ? 'monitor' : 'off')
      )
        .toString()
        .toLowerCase(),
      secret: Env?.EDGE_AUTH_SECRET || '',
      headerName: (Env?.EDGE_AUTH_HEADER || 'x-edge-auth')
        .toString()
        .toLowerCase(),
      exemptPaths: (
        Env?.EDGE_GUARD_EXEMPT_PATHS ||
        '/ping,/health,/version,/v1/api-docs,/favicon.ico'
      )
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },
  };
}

export default {
  ...config(process.env),
  geoGuard: getGeoGuardConfig(process.env),
};
