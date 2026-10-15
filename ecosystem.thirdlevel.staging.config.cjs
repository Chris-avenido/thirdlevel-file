module.exports = {
  apps: [
    {
      name: 'insighted-thirdlevel-staging',
      script: 'api/src/index.js',
      env: {
        NODE_ENV: 'staging',
        PORT: 5028,
      },
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      node_args: '--max-old-space-size=4096',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }
  ]
};
