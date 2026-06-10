---
Task ID: 1
Agent: Main Agent
Task: Push bildirim sistemi — site kapalıyken bildirim gönderme sorunu

Work Log:
- Mevcut projeyi inceledim: Next.js 16, App Router, SQLite, web-push, Service Worker
- Sorun teşhisi: notification-scheduler mini-servisi hiç çalışmıyordu (start.sh'ta yoktu)
- Frontend'deki bildirimler sadece setInterval + new Notification() ile tarayıcı açıkken çalışıyordu
- Instrumentation.ts oluşturdum — sunucu başladığında otomatik scheduler başlıyor
- HTTP fetch yerine doğrudan DB + web-push ile bildirim gönderme (recursive sorun önleme)
- Frontend'de çift bildirim önleme: push aktifken lokal bildirim engellendi
- pushsubscriptionchange event'i eklendi (SW abonelik yenileme)
- manifest.json ve PWA desteği eklendi
- Test endpoint'i eklendi (/api/push/test)
- Bildirim tag'lerine tarih eklendi (aynı gün tekrar gönderim önleme)
- Push subscription route'una resubscribe desteği eklendi

Stage Summary:
- Ana sorun çözüldü: notification scheduler artık Next.js instrumentation.ts ile otomatik başlıyor
- Site kapalıyken push bildirim artık web-push protokolü ile gönderiliyor
- Production build başarılı
- Tüm endpoint'ler çalışıyor (/api/push, /api/push/notify, /api/push/test)
