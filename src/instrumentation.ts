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

    const CHECK_INTERVAL = 15_000; // 15 saniye — daha sık kontrol, bildirim kaçırma riskini azaltır
    const NOTIFICATION_WINDOW = 90_000; // 90 saniye — namaz vaktinden sonraki 90 saniye içinde bildirim gönder

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

        // ── Tekrar bildirim engelleme ──
        // Aynı namaz vakti için aynı gün tekrar bildirim göndermeyi önler
        // Key format: "prayer-{key}-{localDate}" veya "prealarm-{key}-{localDate}"
        const sentNotifications = new Map<string, number>(); // key → timestamp
        const SENT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 saatte bir temizle

        // Periyodik olarak eski kayıtları temizle
        setInterval(() => {
          const now = Date.now();
          for (const [key, ts] of sentNotifications) {
            if (now - ts > SENT_CACHE_TTL) {
              sentNotifications.delete(key);
            }
          }
        }, 60 * 60 * 1000); // Her saat başı temizle

        /**
         * Kullanıcının yerel tarihini YYYY-MM-DD formatında döndürür
         * Sunucu saat diliminden bağımsız olarak doğru tarihi hesaplar
         */
        const getLocalDateStr = (utcDate: Date, timezone: number): string => {
          const utcMs = utcDate.getTime();
          const userLocalMs = utcMs + timezone * 3600000;
          const userLocalDate = new Date(userLocalMs);
          const y = userLocalDate.getUTCFullYear();
          const m = String(userLocalDate.getUTCMonth() + 1).padStart(2, '0');
          const d = String(userLocalDate.getUTCDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        };

        const checkAndNotify = async () => {
          if (isRunning) return;
          isRunning = true;

          try {
            const subscriptions = await db.pushSubscription.findMany();
            const now = new Date();
            let notificationsSent = 0;

            if (subscriptions.length === 0) {
              // Abonelik yoksa sessizce devam et
              return;
            }

            console.log(`[Scheduler] Kontrol: ${now.toISOString()} — ${subscriptions.length} abonelik`);

            for (const sub of subscriptions) {
              try {
                const method = sub.method as any;
                const mc = METHOD_CONFIGS[method];
                if (!mc) {
                  console.warn(`[Scheduler] Bilinmeyen yöntem: ${method} — abonelik atlanıyor (ID: ${sub.id})`);
                  continue;
                }

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

                // Kullanıcının yerel tarihini timezone ile hesapla (UTC değil!)
                const localDateStr = getLocalDateStr(now, sub.timezone);

                for (const p of prayerOrder) {
                  const alarm = alarms[p.key];
                  if (!alarm || !alarm.alarm) continue;

                  const prayerTime = result.times[p.key];
                  if (!prayerTime) continue;

                  const diff = prayerTime.getTime() - now.getTime();

                  // Ana bildirim: vaktin tam zamanında (0 ile -NOTIFICATION_WINDOW ms arası)
                  if (diff <= 0 && diff > -NOTIFICATION_WINDOW) {
                    const notifKey = `prayer-${p.key}-${localDateStr}`;

                    // Tekrar bildirim kontrolü
                    if (sentNotifications.has(notifKey)) {
                      continue; // Bu vakit için bugün zaten bildirim gönderilmiş
                    }

                    const payload = {
                      title: `${p.label} Vakti`,
                      body: `${p.label} vakti geldi: ${formatTime(prayerTime)}`,
                      icon: '/favicon.ico',
                      tag: notifKey,
                      prayerKey: p.key,
                      url: '/',
                    };

                    try {
                      await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        JSON.stringify(payload)
                      );
                      sentNotifications.set(notifKey, Date.now());
                      notificationsSent++;
                      console.log(`[Scheduler] Bildirim gönderildi: ${notifKey}`);
                    } catch (pushError: any) {
                      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                        await db.pushSubscription.delete({ where: { id: sub.id } });
                        console.log(`[Scheduler] Süresi dolmuş abonelik silindi: ${sub.id}`);
                      } else {
                        console.error(`[Scheduler] Push hatası (${p.key}): ${pushError.message}`);
                      }
                    }
                  }

                  // Pre-alarm bildirimi: vaktin X dakika öncesinde
                  if (alarm.preAlarm?.enabled && alarm.preAlarm.minutes > 0) {
                    const preAlarmTime = prayerTime.getTime() - alarm.preAlarm.minutes * 60 * 1000;
                    const preAlarmDiff = preAlarmTime - now.getTime();

                    // Pre-alarm: preAlarmTime'dan sonra NOTIFICATION_WINDOW ms içinde
                    if (preAlarmDiff <= 0 && preAlarmDiff > -NOTIFICATION_WINDOW) {
                      const notifKey = `prealarm-${p.key}-${localDateStr}`;

                      // Tekrar bildirim kontrolü
                      if (sentNotifications.has(notifKey)) {
                        continue;
                      }

                      const payload = {
                        title: `${p.label} Yaklaşıyor`,
                        body: `${p.label} vaktine ${alarm.preAlarm.minutes} dakika kaldı`,
                        icon: '/favicon.ico',
                        tag: notifKey,
                        prayerKey: p.key,
                        url: '/',
                      };

                      try {
                        await webpush.sendNotification(
                          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                          JSON.stringify(payload)
                        );
                        sentNotifications.set(notifKey, Date.now());
                        notificationsSent++;
                        console.log(`[Scheduler] Pre-alarm gönderildi: ${notifKey}`);
                      } catch (pushError: any) {
                        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                          await db.pushSubscription.delete({ where: { id: sub.id } });
                          console.log(`[Scheduler] Süresi dolmuş abonelik silindi: ${sub.id}`);
                        } else {
                          console.error(`[Scheduler] Pre-alarm push hatası (${p.key}): ${pushError.message}`);
                        }
                      }
                    }
                  }
                }
              } catch (subError: any) {
                console.error(`[Scheduler] Abonelik hatası (ID: ${sub.id}): ${subError.message}`);
              }
            }

            if (notificationsSent > 0) {
              console.log(`[Scheduler] Toplam ${notificationsSent} bildirim gönderildi (${subscriptions.length} abonelik)`);
            }
          } catch (error: any) {
            console.error(`[Scheduler] Hata: ${error.message}`);
          } finally {
            isRunning = false;
          }
        };

        // İlk kontrolü 10 saniye sonra yap (sunucunun tamamen hazır olması için)
        setTimeout(() => {
          checkAndNotify();
          setInterval(checkAndNotify, CHECK_INTERVAL);
          console.log(`[Instrumentation] Notification scheduler aktif — ${CHECK_INTERVAL / 1000}s aralıkla, ${NOTIFICATION_WINDOW / 1000}s bildirim penceresi`);
        }, 10_000);

      } catch (error: any) {
        console.error(`[Instrumentation] Scheduler başlatma hatası: ${error.message}`);
      }
    };

    // Scheduler'ı başlat
    startScheduler();
  }
}
