module.exports = {
  apps: [
    {
      name: 'setspace-api',
      cwd: '/root/setspace',
      script: 'node',
      args: './artifacts/api-server/dist/index.cjs',
      env_file: '/root/setspace/.env',
      env: {
        NODE_ENV: 'production',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
