#!/bin/bash
set -e
cd /root/setspace
echo "==> Pulling latest code..."
git pull
echo "==> Restarting API..."
pm2 restart setspace-api
echo ""
echo "Done. Hard refresh your browser with Ctrl+Shift+R."
