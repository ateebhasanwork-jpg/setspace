const fs = require('fs');
const path = require('path');

// Parse .env file manually — no dotenv dependency needed
function loadEnv(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      env[key] = val;
    });
    return env;
  } catch {
    return {};
  }
}

const env = loadEnv(path.join(__dirname, '.env'));

module.exports = {
  apps: [
    {
      name: 'setspace-api',
      script: 'node',
      args: path.join(__dirname, 'artifacts/api-server/dist/index.cjs'),
      env: {
        NODE_ENV: 'production',
        ...env,
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
