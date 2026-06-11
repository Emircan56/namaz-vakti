#!/bin/bash
cd /home/z/my-project
export NODE_ENV=production
export HOSTNAME=0.0.0.0
export PORT=3000

# .env dosyasını standalone dizinine kopyala (VAPID keyler vb.)
cp -f .env .next/standalone/.env 2>/dev/null || true

# Notification scheduler artık Next.js instrumentation.ts ile otomatik başlıyor
# Ayrı bir süreç çalıştırmaya gerek yok

echo "================================================"
echo "  Süleymaniye Vakfı Namaz Vakitleri"
echo "  Push Bildirim Scheduler: Otomatik (instrumentation.ts)"
echo "================================================"

exec node .next/standalone/server.js
