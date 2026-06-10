/**
 * Next.js Instrumentation Hook
 *
 * Sunucu başladığında notification scheduler'ı otomatik başlatır.
 * API endpoint'ine HTTP isteği yapmak yerine doğrudan veritabanı
 * sorgulayıp web-push ile bildirim gönderir — böylece HTTP çağrısından
 * kaynaklanan sorunlar önlenir.
 *
 * Push bildirimleri web-push protokolü ile tarayıcı kapalıyken bile gönderilir.
 */

export async function register() {
  // Sadece sunucu tarafında çalıştır
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Notification scheduler başlatılıyor...');

    const CHECK_INTERVAL = 30_000; // 30 saniye

    // Dinamik import — bu modüller sadece sunucuda mevcut
    const startScheduler = async () => {
      try {
        const { db } = await import('@/lib/db');
        const webpush = (await import('web-push')).default;
        const {
          SuleymaniyePrayerCalculator,
          DEFAULT_CONFIG,
          METHOD_CONFIGS,
          formatTime,
          getPrayerOrder,
        } = await import('@/lib/prayer-calculator');

        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
        const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
        const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:prayer@suleymaniye.com';

        if (!vapidPublicKey || !vapidPrivateKey) {
          console.error('[Scheduler] VAPID key\'ler bulunamadı — scheduler başlatılamadı');
          return;
        }

        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

        let isRunning = false;

        const checkAndNotify = async () => {
          if (isRunning) return;
          isRunning = true;

          try {
            const subscriptions = await db.pushSubscription.findMany();
            const now = new Date();
            let notificationsSent = 0;

            for (const sub of subscriptions) {
              try {
                const method = sub.method as any;
                const mc = METHOD_CONFIGS[method];
                if (!mc) continue;

                const config = {
                  method,
                  imsakAngle: mc.imsakAngle ?? DEFAULT_CONFIG.imsakAngle,
                  yatsiAngle: mc.yatsiAngle ?? DEFAULT_CONFIG.yatsiAngle,
                  asrType: mc.asrType ?? DEFAULT_CONFIG.asrType,
                  temkin: mc.temkin ?? DEFAULT_CONFIG.temkin,
                };

                const calculator = new SuleymaniyePrayerCalculator(config, sub.asrMadhab as 'standard' | 'hanafi');
                const result = calculator.calculate(now, {
                  latitude: sub.latitude,
                  longitude: sub.longitude,
                  timezone: sub.timezone,
                  city: sub.city,
                });

                const alarms = JSON.parse(sub.alarms || '{}');
                const prayerOrder = getPrayerOrder(method);

                for (const p of prayerOrder) {
                  const alarm = alarms[p.key];
                  if (!alarm || !alarm.alarm) continue;

                  const prayerTime = result.times[p.key];
                  const diff = prayerTime.getTime() - now.getTime();

                  // Ana bildirim: vaktin tam zamanında (±60 saniye)
                  if (diff <= 0 && diff > -60000) {
                    const todayStr = now.toISOString().slice(0, 10);
                    const payload = {
                      title: `${p.label} Vakti`,
                      body: `${p.label} vakti geldi: ${formatTime(prayerTime)}`,
                      icon: '/favicon.ico',
                      tag: `prayer-${p.key}-${todayStr}`,
                      prayerKey: p.key,
                      url: '/',
                    };

                    try {
                      await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        JSON.stringify(payload)
                      );
                      notificationsSent++;
                    } catch (pushError: any) {
                      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                        await db.pushSubscription.delete({ where: { id: sub.id } });
                      }
                    }
                  }

                  // Pre-alarm bildirimi
                  if (alarm.preAlarm?.enabled && alarm.preAlarm.minutes > 0) {
                    const preAlarmDiff = diff - alarm.preAlarm.minutes * 60 * 1000;
                    if (preAlarmDiff <= 0 && preAlarmDiff > -60000) {
                      const todayStr = now.toISOString().slice(0, 10);
                      const payload = {
                        title: `${p.label} Yaklaşıyor`,
                        body: `${p.label} vaktine ${alarm.preAlarm.minutes} dakika kaldı`,
                        icon: '/favicon.ico',
                        tag: `prealarm-${p.key}-${todayStr}`,
                        prayerKey: p.key,
                        url: '/',
                      };

                      try {
                        await webpush.sendNotification(
                          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                          JSON.stringify(payload)
                        );
                        notificationsSent++;
                      } catch (pushError: any) {
                        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                          await db.pushSubscription.delete({ where: { id: sub.id } });
                        }
                      }
                    }
                  }
                }
              } catch (subError) {
                // Sessizce devam et
              }
            }

            if (notificationsSent > 0) {
              console.log(`[Scheduler] ${notificationsSent} bildirim gönderildi (${subscriptions.length} abonelik)`);
            }
          } catch (error: any) {
            console.error(`[Scheduler] Hata: ${error.message}`);
          } finally {
            isRunning = false;
          }
        };

        // İlk kontrolü 15 saniye sonra yap (sunucunun tamamen hazır olması için)
        setTimeout(() => {
          checkAndNotify();
          setInterval(checkAndNotify, CHECK_INTERVAL);
          console.log(`[Instrumentation] Notification scheduler aktif — ${CHECK_INTERVAL / 1000}s aralıkla`);
        }, 15_000);

      } catch (error: any) {
        console.error(`[Instrumentation] Scheduler başlatma hatası: ${error.message}`);
      }
    };

    // Scheduler'ı başlat
    startScheduler();
  }
}
