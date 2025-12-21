const instances = process.env.NODE_ENV === 'production' ? 'max' : 2;

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
            },
            env_development: {
                NODE_ENV: 'development',
                PORT: 8090,
            },
            // Graceful shutdown
            kill_timeout: 5000,
            wait_ready: true,
            listen_timeout: 10000,

            // Auto-restart on crash
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',

            // Logging
            error_file: './logs/pm2-error.log',
            out_file: './logs/pm2-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,

            // Monitoring
            instance_var: 'INSTANCE_ID',
        },
    ],
};
