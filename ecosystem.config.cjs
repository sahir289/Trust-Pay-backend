const instances = process.env.NODE_ENV === 'production' ? 'max' : 2;
const os = require('os');
const dbPoolInstanceCount = process.env.DB_POOL_INSTANCE_COUNT || (instances === 'max' ? String(os.cpus().length) : String(instances));
//dldfm
module.exports = {
    apps: [
        {
            name: 'trust-pay-backend',
            script: './server.js',
            instances: instances, // 2 instances for dev, all cores for prod
            exec_mode: 'cluster',
            max_memory_restart: '1G',
            node_args: '--max-old-space-size=2048',
            env_production: {
                NODE_ENV: 'production',
                PORT: 8090,
                RUN_CRONS: 'false', // Don't run crons in cluster workers
                CLOUDWATCH_MODE: 'all', // per-worker streams: best to avoid missing logs on worker rotation
                ENABLE_CENTRAL_LOG_INGESTOR: 'true',
                LOG_INGESTOR_QUEUE: 'trust-pay-central-logs',
                LOG_DEDUPE_TTL_SECONDS: '300',
                DB_GLOBAL_MAX_CONNECTIONS: '150',
                DB_RESERVED_CONNECTIONS: '30',
                DB_WRITER_POOL_RATIO: '0.4',
                DB_READER_POOL_RATIO: '0.6',
                DB_POOL_MIN_PER_PROCESS: '3',
                DB_POOL_INSTANCE_COUNT: dbPoolInstanceCount,
            },
            env_development: {
                NODE_ENV: 'development',
                PORT: 8090,
                RUN_CRONS: 'false',
                CLOUDWATCH_MODE: 'all',
                ENABLE_CENTRAL_LOG_INGESTOR: 'true',
                LOG_INGESTOR_QUEUE: 'trust-pay-central-logs',
                LOG_DEDUPE_TTL_SECONDS: '120',
                DB_GLOBAL_MAX_CONNECTIONS: '40',
                DB_RESERVED_CONNECTIONS: '10',
                DB_WRITER_POOL_RATIO: '0.4',
                DB_READER_POOL_RATIO: '0.6',
                DB_POOL_MIN_PER_PROCESS: '2',
                DB_POOL_INSTANCE_COUNT: dbPoolInstanceCount,
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
            instances: 1, // Always single instance
            exec_mode: 'fork', // Not clustered
            max_memory_restart: '512M',
            node_args: '--max-old-space-size=1024',
            env_production: {
                NODE_ENV: 'production',
                ENABLE_CENTRAL_LOG_INGESTOR: 'true',
                LOG_INGESTOR_QUEUE: 'trust-pay-central-logs',
                LOG_DEDUPE_TTL_SECONDS: '300',
                DB_GLOBAL_MAX_CONNECTIONS: '150',
                DB_RESERVED_CONNECTIONS: '30',
                DB_WRITER_POOL_RATIO: '0.4',
                DB_READER_POOL_RATIO: '0.6',
                DB_POOL_MIN_PER_PROCESS: '1',
                DB_POOL_MAX_PER_PROCESS: '6',
                DB_POOL_INSTANCE_COUNT: '1',
            },
            env_development: {
                NODE_ENV: 'development',
                ENABLE_CENTRAL_LOG_INGESTOR: 'true',
                LOG_INGESTOR_QUEUE: 'trust-pay-central-logs',
                LOG_DEDUPE_TTL_SECONDS: '120',
                DB_GLOBAL_MAX_CONNECTIONS: '40',
                DB_RESERVED_CONNECTIONS: '10',
                DB_WRITER_POOL_RATIO: '0.4',
                DB_READER_POOL_RATIO: '0.6',
                DB_POOL_MIN_PER_PROCESS: '1',
                DB_POOL_MAX_PER_PROCESS: '4',
                DB_POOL_INSTANCE_COUNT: '1',
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
            name: 'trust-pay-log-ingestor',
            script: './src/worker/log-ingestor.js',
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '512M',
            node_args: '--max-old-space-size=1024',
            env_production: {
                NODE_ENV: 'production',
                LOG_INGESTOR: 'true',
                LOG_INGESTOR_QUEUE: 'trust-pay-central-logs',
                LOG_DEDUPE_TTL_SECONDS: '300',
            },
            env_development: {
                NODE_ENV: 'development',
                LOG_INGESTOR: 'true',
                LOG_INGESTOR_QUEUE: 'trust-pay-central-logs',
                LOG_DEDUPE_TTL_SECONDS: '120',
            },
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            error_file: './logs/pm2-log-ingestor-error.log',
            out_file: './logs/pm2-log-ingestor-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        },
    ],
};
