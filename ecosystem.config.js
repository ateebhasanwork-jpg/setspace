require('dotenv').config({ path: __dirname + '/.env' });

module.exports = {
  apps: [
    {
      name: 'setspace-api',
      cwd: __dirname,
      script: 'node',
      args: './artifacts/api-server/dist/index.cjs',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || '8080',
        DATABASE_URL: process.env.DATABASE_URL,
        SESSION_SECRET: process.env.SESSION_SECRET,
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
