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
            },
            env_development: {
                NODE_ENV: 'development',
                PORT: 8090,
                FORCE_COLOR: '1',
                RUN_CRONS: 'false',
                LOG_DIR: 'logs',
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
            },
            env_development: {
                NODE_ENV: 'development',
                FORCE_COLOR: '1',
                LOG_DIR: 'logs',
                BANK_RESPONSE_BOT_BULK_PREFETCH: 2,
                BANK_RESPONSE_BOT_BULK_MAX_RETRIES: 5,
                DB_WRITER_POOL_MAX: 10,
                DB_READER_POOL_MAX: 5,
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
                CW_STREAM_PREFIX: '',
                CW_START_POSITION: 'beginning',
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
                CW_STREAM_PREFIX: 'dev-',
                CW_START_POSITION: 'beginning',
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
