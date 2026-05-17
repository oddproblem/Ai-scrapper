export default {
  apps: [
    {
      name: 'startup-aggregator',
      script: './server.js',
      instances: 1, // single instance to avoid duplicate cron jobs
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
    },
  ],
};
