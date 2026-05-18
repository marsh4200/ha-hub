module.exports = {
  apps: [
    {
      name: 'ha-hub-api',
      cwd: './backend',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '500M',
      out_file: './logs/api.out.log',
      error_file: './logs/api.err.log',
      time: true,
    },
  ],
};
