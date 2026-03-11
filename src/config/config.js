import dotenv from 'dotenv';
import getGeoGuardConfig from './geoGuard.js';
dotenv.config({ path: '.env' });

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
      accessKeyId: Env?.ACCESS_KEY,
      secretAccessKey: Env.secretKeyS3,
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
      queueName: Env?.RABBITMQ_QUEUE_NAME || 'trust-pay-queue',
      exchangeName: Env?.RABBITMQ_EXCHANGE_NAME || 'trust-pay-exchange',
      routingKey: Env?.RABBITMQ_ROUTING_KEY || 'trust-pay-routing-key',
      prefetchCount: parseInt(Env?.RABBITMQ_PREFETCH_COUNT) || 1,
      connectionTimeout: parseInt(Env?.RABBITMQ_CONNECTION_TIMEOUT) || 10000, // in milliseconds
      heartbeat: parseInt(Env?.RABBITMQ_HEARTBEAT) || 60,
      retryAttempts: parseInt(Env?.RABBITMQ_RETRY_ATTEMPTS) || 5,
      retryDelay: parseInt(Env?.RABBITMQ_RETRY_DELAY) || 5000, // in milliseconds
      bankResponseQueue: 'bank-response-queue', // Add this line
    },
    telegram: {
      telegram_url: Env?.TELEGRAM_URL,
    },
    ocr: {
      url: Env?.OCR_URL,
    },
    rateLimiter: {
      points: parseInt(Env?.RATE_LIMIT_POINTS) || 20,
      duration: parseInt(Env?.RATE_LIMIT_DURATION) || 60,
      blockDuration: parseInt(Env?.RATE_LIMIT_BLOCK_DURATION) || 30,
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
    clickrr : {
      baseUrl: Env?.CLICKRR_BASE_API_URL,
      initiatePayout: Env?.CLICKRR_INITIATE_API_URL,
      walletBalance: Env?.CLICKRR_WALLET_BALANCE_API_URL,
      apiKey: Env?.CLICKRR_API_KEY,
      apiSecret: Env?.CLICKRR_API_SECRET,
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
    // reactAppBaseUrl: Env?.REACT_APP_BASE_URL,
    databaseUrl: Env?.DATABASE_URL,
    databaseWriterUrl: Env?.DATABASE_WRITER_URL,
    databaseReaderUrl: Env?.DATABASE_READER_URL,
    accessTokenSecretKey: Env?.ACCESS_TOKEN_SECRET_KEY,
    accessTokenExpireTime: 24 * 60 * 60, // in seconds
    reactFrontOrigin: Env?.REACT_FRONT_ORIGIN,
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
