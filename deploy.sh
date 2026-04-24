#!/bin/bash
set -e

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_DIR"

echo "==> Pulling latest code..."
git pull

echo "==> Building frontend..."
cd "$DEPLOY_DIR/artifacts/setspace"
pnpm install
./node_modules/.bin/vite build --config vite.config.ts

echo "==> Restarting API..."
pm2 restart setspace-api

echo ""
echo "Done. Hard refresh your browser with Ctrl+Shift+R."
