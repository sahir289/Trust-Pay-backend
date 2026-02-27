const instances = process.env.NODE_ENV === 'production' ? 'max' : 2;
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
            },
            env_development: {
                NODE_ENV: 'development',
                PORT: 8090,
                RUN_CRONS: 'false',
                CLOUDWATCH_MODE: 'all',
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
            },
            env_development: {
                NODE_ENV: 'development',
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
    ],
};
