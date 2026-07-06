const instances = process.env.NODE_ENV === 'production' ? 'max' : 2;

module.exports = {
    apps: [
        {
            name: 'trust-pay-backend',
            script: './server.js',
            cwd: __dirname,
            instances: instances, // 2 instances for dev, all cores for prod
            exec_mode: 'cluster',
            max_memory_restart: '1G',
            node_args: '--max-old-space-size=2048',
            env: {
                FORCE_COLOR: '1',
                LOG_DIR: 'logs',
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 8090,
                FORCE_COLOR: '1',
                RUN_CRONS: 'false', // Don't run crons in cluster workers
                LOG_DIR: 'logs',
                // Flip to 'true' only once the DATABASE_*_URL endpoints point at
                // RDS Proxy / PgBouncer. Then the app uses small per-process
                // pools and applies session settings via startup options so the
                // proxy can multiplex connections (no session pinning).
                DB_BEHIND_PROXY: 'false',
                // Flip to 'true' to deliver merchant callbacks via the durable
                // RabbitMQ queue (retry + DLQ) instead of inline HTTP. Must be
                // set consistently across all producer processes.
                CALLBACK_QUEUE_ENABLED: 'false',
                // Flip to 'true' to HMAC-sign outgoing merchant callbacks.
                // CALLBACK_SIGNING_SECRET must be supplied via the environment /
                // secrets manager (never commit the secret value here).
                CALLBACK_SIGNING_ENABLED: 'false',
                // Flip to 'true' to deliver Telegram text alerts via the durable
                // RabbitMQ queue (retry + DLQ) instead of the in-process sender.
                TELEGRAM_QUEUE_ENABLED: 'false',
                // Flip to 'true' to process the Telegram OCR webhook off the API
                // process (RabbitMQ worker) instead of inline after the 200.
                OCR_QUEUE_ENABLED: 'false',
                // Hard timeout (ms) for the external OCR HTTP call so a slow OCR
                // service can't hang a request / hold DB resources.
                OCR_TIMEOUT_MS: 15000,
                // Flip to 'true' to enforce Idempotency-Key replay protection on
                // mutating v2 endpoints (prevents double charge / double payout
                // on retries). Requires the "IdempotencyKey" table to exist.
                IDEMPOTENCY_ENABLED: 'false',
                // HMAC-SHA256 request signatures (x-signature + x-timestamp),
                // verified with the per-merchant secret (no shared env secret).
                // NOTE: the core v2 merchant endpoints (create payIn/payOut,
                // process-payin, wallet balance, check-status) ALWAYS require a
                // valid signature regardless of this flag. This flag only turns
                // signing on for additional opt-in v2 routes.
                REQUEST_SIGNING_ENABLED: 'false',
            },
            env_development: {
                NODE_ENV: 'development',
                PORT: 8090,
                FORCE_COLOR: '1',
                RUN_CRONS: 'false',
                LOG_DIR: 'logs',
                DB_BEHIND_PROXY: 'false',
                CALLBACK_QUEUE_ENABLED: 'false',
                CALLBACK_SIGNING_ENABLED: 'false',
                TELEGRAM_QUEUE_ENABLED: 'false',
                OCR_QUEUE_ENABLED: 'false',
                OCR_TIMEOUT_MS: 15000,
                IDEMPOTENCY_ENABLED: 'false',
                REQUEST_SIGNING_ENABLED: 'false',
            },
            // Graceful shutdown
            kill_timeout: 5000,
            wait_ready: true,
            listen_timeout: 10000,

            // Auto-restart on crash
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',

            // Logging - PM2 file logging enabled for EC2 monitoring
            error_file: './logs/pm2-error.log',
            out_file: './logs/pm2-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            combine_logs: true, // Combine logs from all instances

            // Monitoring
            instance_var: 'INSTANCE_ID',
        },
        {
            name: 'trust-pay-crons',
            script: './cron-worker.js',
            cwd: __dirname,
            instances: 1, // Always single instance
            exec_mode: 'fork', // Not clustered
            max_memory_restart: '512M',
            node_args: '--max-old-space-size=1024',
            env: {
                FORCE_COLOR: '1',
                LOG_DIR: 'logs',
            },
            env_production: {
                NODE_ENV: 'production',
                FORCE_COLOR: '1',
                LOG_DIR: 'logs',
                BANK_RESPONSE_BOT_BULK_PREFETCH: 20,
                BANK_RESPONSE_BOT_BULK_MAX_RETRIES: 5,
                DB_WRITER_POOL_MAX: 10,
                DB_READER_POOL_MAX: 20,
                CALLBACK_QUEUE_ENABLED: 'false',
                CALLBACK_SIGNING_ENABLED: 'false',
                TELEGRAM_QUEUE_ENABLED: 'false',
            },
            env_development: {
                NODE_ENV: 'development',
                FORCE_COLOR: '1',
                LOG_DIR: 'logs',
                BANK_RESPONSE_BOT_BULK_PREFETCH: 2,
                BANK_RESPONSE_BOT_BULK_MAX_RETRIES: 5,
                DB_WRITER_POOL_MAX: 10,
                DB_READER_POOL_MAX: 5,
                CALLBACK_QUEUE_ENABLED: 'false',
                CALLBACK_SIGNING_ENABLED: 'false',
                TELEGRAM_QUEUE_ENABLED: 'false',
            },
            // Auto-restart on crash
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',

            // Logging - PM2 file logging enabled for EC2 monitoring
            error_file: './logs/pm2-cron-error.log',
            out_file: './logs/pm2-cron-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        },
        {
            name: 'trust-pay-rabbitmq',
            script: './rabbitmq-worker.js',
            cwd: __dirname,
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '512M',
            node_args: '--max-old-space-size=1024',
            env: {
                FORCE_COLOR: '1',
                LOG_DIR: 'logs',
            },
            env_production: {
                NODE_ENV: 'production',
                FORCE_COLOR: '1',
                LOG_DIR: 'logs',
                BANK_RESPONSE_BOT_BULK_PREFETCH: 4,
                BANK_RESPONSE_BOT_BULK_MAX_RETRIES: 5,
                PAYIN_PROCESS_PREFETCH: 20,
                PAYIN_PROCESS_MAX_RETRIES: 5,
                PAYIN_PROCESS_RETRY_DELAY_MS: 10000,
                DB_WRITER_POOL_MAX: 12,
                DB_READER_POOL_MAX: 6,
                DB_CONN_HOLD_WARN_MS: 45000,
                BANK_RESPONSE_DB_LOCK_TIMEOUT_MS: 10000,
                BANK_RESPONSE_DB_STATEMENT_TIMEOUT_MS: 45000,
                DLQ_REPLAYER_ENABLED: 'true',
                DLQ_REPLAYER_PREFETCH: 1,
                DLQ_REPLAYER_MAX_ATTEMPTS: 3,
                DLQ_REPLAYER_INTERVAL_MS: 1000,
                DLQ_REPLAYER_ERROR_BACKOFF_MS: 3000,
                CALLBACK_QUEUE_ENABLED: 'false',
                CALLBACK_SIGNING_ENABLED: 'false',
                MERCHANT_CALLBACK_PREFETCH: 20,
                MERCHANT_CALLBACK_MAX_RETRIES: 5,
                MERCHANT_CALLBACK_RETRY_DELAY_MS: 10000,
                TELEGRAM_QUEUE_ENABLED: 'false',
                TELEGRAM_MESSAGE_PREFETCH: 1,
                TELEGRAM_MESSAGE_MAX_RETRIES: 5,
                TELEGRAM_MESSAGE_RETRY_DELAY_MS: 10000,
                TELEGRAM_MESSAGE_RATE_LIMIT_MS: 500,
                OCR_QUEUE_ENABLED: 'false',
                TELEGRAM_OCR_PREFETCH: 4,
                TELEGRAM_OCR_MAX_RETRIES: 3,
                TELEGRAM_OCR_RETRY_DELAY_MS: 15000,
                // Flip to 'true' to write an audit row per consumer delivery
                // attempt into the DeliveryAttempt table (run the migration first).
                DELIVERY_ATTEMPTS_LOG_ENABLED: 'false',
            },
            env_development: {
                NODE_ENV: 'development',
                FORCE_COLOR: '1',
                LOG_DIR: 'logs',
                BANK_RESPONSE_BOT_BULK_PREFETCH: 2,
                BANK_RESPONSE_BOT_BULK_MAX_RETRIES: 5,
                PAYIN_PROCESS_PREFETCH: 5,
                PAYIN_PROCESS_MAX_RETRIES: 5,
                PAYIN_PROCESS_RETRY_DELAY_MS: 10000,
                DB_WRITER_POOL_MAX: 8,
                DB_READER_POOL_MAX: 4,
                DB_CONN_HOLD_WARN_MS: 30000,
                BANK_RESPONSE_DB_LOCK_TIMEOUT_MS: 10000,
                BANK_RESPONSE_DB_STATEMENT_TIMEOUT_MS: 45000,
                DLQ_REPLAYER_ENABLED: 'true',
                DLQ_REPLAYER_PREFETCH: 1,
                DLQ_REPLAYER_MAX_ATTEMPTS: 3,
                DLQ_REPLAYER_INTERVAL_MS: 1500,
                DLQ_REPLAYER_ERROR_BACKOFF_MS: 3000,
                CALLBACK_QUEUE_ENABLED: 'false',
                CALLBACK_SIGNING_ENABLED: 'false',
                MERCHANT_CALLBACK_PREFETCH: 5,
                MERCHANT_CALLBACK_MAX_RETRIES: 5,
                MERCHANT_CALLBACK_RETRY_DELAY_MS: 10000,
                TELEGRAM_QUEUE_ENABLED: 'false',
                TELEGRAM_MESSAGE_PREFETCH: 1,
                TELEGRAM_MESSAGE_MAX_RETRIES: 5,
                TELEGRAM_MESSAGE_RETRY_DELAY_MS: 10000,
                TELEGRAM_MESSAGE_RATE_LIMIT_MS: 500,
                OCR_QUEUE_ENABLED: 'false',
                TELEGRAM_OCR_PREFETCH: 2,
                TELEGRAM_OCR_MAX_RETRIES: 3,
                TELEGRAM_OCR_RETRY_DELAY_MS: 15000,
                DELIVERY_ATTEMPTS_LOG_ENABLED: 'false',
            },
            kill_timeout: 5000,
            wait_ready: true,
            listen_timeout: 10000,
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            error_file: './logs/pm2-rabbitmq-error.log',
            out_file: './logs/pm2-rabbitmq-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        },
        {
            name: 'trust-pay-cloudwatch-forwarder',
            script: './src/utils/cloudwatchForwarder.js',
            cwd: __dirname,
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '256M',
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            env: {
                FORCE_COLOR: '1',
                LOG_DIR: 'logs',
            },
            env_production: {
                NODE_ENV: 'production',
                FORCE_COLOR: '1',
                LOG_DIR: 'logs',
                CW_POLL_INTERVAL_MS: 1000,
                CW_LOG_LEVEL: 'info',
                CW_LOG_STREAM_NAME: process.env.CW_LOG_STREAM_NAME || 'trust-pay-api-logs',
                CW_START_POSITION: 'beginning',
                CW_DISCOVERY_INTERVAL_MS: 10000,
                CW_MAX_FILES_PER_TICK: 3,
                CW_MAX_BYTES_PER_TICK: 2097152,
                CW_ERROR_THROTTLE_MS: 15000,
                // Dead-letter queue: lines that fail CW delivery are stored here and auto-replayed.
                CW_DLQ_PREFIX: 'cw-dlq',
                CW_DLQ_REPLAY_INTERVAL_MS: 60000,
            },
            env_development: {
                NODE_ENV: 'development',
                FORCE_COLOR: '1',
                LOG_DIR: 'logs',
                CW_POLL_INTERVAL_MS: 1000,
                CW_LOG_LEVEL: 'info',
                CW_LOG_STREAM_NAME: process.env.CW_LOG_STREAM_NAME || 'dev-trust-pay-api-logs',
                CW_START_POSITION: 'beginning',
                CW_DISCOVERY_INTERVAL_MS: 5000,
                CW_MAX_FILES_PER_TICK: 3,
                CW_MAX_BYTES_PER_TICK: 2097152,
                CW_ERROR_THROTTLE_MS: 15000,
                CW_DLQ_PREFIX: 'cw-dlq',
                CW_DLQ_REPLAY_INTERVAL_MS: 60000,
            },
            error_file: './logs/pm2-cw-forwarder-error.log',
            out_file: './logs/pm2-cw-forwarder-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        },
    ],
};
