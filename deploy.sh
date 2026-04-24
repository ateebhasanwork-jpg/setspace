#!/bin/bash
set -e

echo "==> Pulling latest code..."
git pull

echo "==> Installing dependencies..."
pnpm install

echo "==> Building API server..."
pnpm --filter @workspace/api-server run build

echo "==> Building frontend..."
pnpm --filter @workspace/setspace run build

echo "==> Restarting API server..."
pm2 restart setspace-api

echo ""
echo "Deploy complete. Hard refresh your browser (Ctrl+Shift+R)."
