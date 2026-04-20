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
      jwt_expires_in: Env?.JWT_EXPIRES_IN || '2h',
      refresh_token_secret: Env?.REFRESH_TOKEN_SECRET,
      refresh_token_expires_in: Env?.REFRESH_TOKEN_EXPIRES_IN || '7d',
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
    },
    ocr: {
      url: Env?.OCR_URL,
    },
    redis: {
      url: Env?.REDIS_URL || 'redis://localhost:6379',
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
    controllerCacheTtls: {
      auth: {
        session: parsePositiveInt(Env?.AUTH_SESSION_CACHE_TTL_SEC, 30),
      },
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
      },
      payout: {
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
        byId: parsePositiveInt(Env?.SETTLEMENT_BY_ID_CACHE_TTL_SEC, 15),
        list: parsePositiveInt(Env?.SETTLEMENT_LIST_CACHE_TTL_SEC, 20),
        search: parsePositiveInt(Env?.SETTLEMENT_SEARCH_CACHE_TTL_SEC, 20),
      },
      userHierarchy: {
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
    payeasy: {
      url: Env?.PAYEASY_API_URL,
      payeasyClientId: Env?.PAYEASY_CLIENT_ID,
      encryptionKey: Env?.PAYEASY_ENCRYPTION_KEY
    },
    // reactAppBaseUrl: Env?.REACT_APP_BASE_URL,
    databaseUrl: Env?.DATABASE_URL,
    databaseWriterUrl: Env?.DATABASE_WRITER_URL,
    databaseReaderUrl: Env?.DATABASE_READER_URL,
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
  };
}

export default {
  ...config(process.env),
  geoGuard: getGeoGuardConfig(process.env),
};
