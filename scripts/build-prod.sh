#!/bin/bash
set -e

echo "==> Building API server..."
pnpm --filter @workspace/api-server run build

echo "==> Building frontend..."
pnpm --filter @workspace/setspace run build

echo "==> Build complete."
echo "    API:      artifacts/api-server/dist/index.cjs"
echo "    Frontend: artifacts/setspace/dist/"
