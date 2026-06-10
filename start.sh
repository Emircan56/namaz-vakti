#!/bin/bash
cd /home/z/my-project
export NODE_ENV=production
export HOSTNAME=0.0.0.0
export PORT=3000

# Notification scheduler artık Next.js instrumentation.ts ile otomatik başlıyor
# Ayrı bir süreç çalıştırmaya gerek yok

echo "================================================"
echo "  Süleymaniye Vakfı Namaz Vakitleri"
echo "  Push Bildirim Scheduler: Otomatik (instrumentation.ts)"
echo "================================================"

exec node .next/standalone/server.js
