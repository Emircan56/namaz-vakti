import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import webpush from 'web-push';
import {
  SuleymaniyePrayerCalculator,
  DEFAULT_CONFIG,
  METHOD_CONFIGS,
  type CalculationMethod,
  formatTimeForTimezone,
  getPrayerOrder,
  type PrayerAlarmSetting,
} from '@/lib/prayer-calculator';

// VAPID yapılandırması
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:prayer@suleymaniye.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

// Bildirim penceresi: 5 dakika (Vercel cron dakikalarca gecikebilir)
const NOTIFICATION_WINDOW_MS = 5 * 60 * 1000; // 300000ms

// Bellek içi tekrar engelleme (SentNotification tablosu olmadan çalışabilmesi için)
const sentKeysCache = new Set<string>();

/**
 * Kullanıcının yerel tarihini YYYY-MM-DD formatında döndürür
 */
function getLocalDateStr(utcDate: Date, timezone: number): string {
  const utcMs = utcDate.getTime();
  const userLocalMs = utcMs + timezone * 3600000;
  const userLocalDate = new Date(userLocalMs);
  const y = userLocalDate.getUTCFullYear();
  const m = String(userLocalDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(userLocalDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Çift abonelikleri temizle — aynı endpoint'ten birden fazla varsa eskisini sil
 */
async function cleanupDuplicateSubscriptions() {
  try {
    const subs = await db.pushSubscription.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const seenEndpoints = new Set<string>();
    const duplicates: string[] = [];

    for (const sub of subs) {
      if (seenEndpoints.has(sub.endpoint)) {
        duplicates.push(sub.id);
      } else {
        seenEndpoints.add(sub.endpoint);
      }
    }

    if (duplicates.length > 0) {
      await db.pushSubscription.deleteMany({
        where: { id: { in: duplicates } },
      });
    }

    return duplicates.length;
  } catch {
    return 0;
  }
}

/**
 * Bildirim zaten gönderilmiş mi kontrol et (DB + bellek)
 */
async function isAlreadySent(notifKey: string): Promise<boolean> {
  if (sentKeysCache.has(notifKey)) return true;
  try {
    const existing = await db.sentNotification.findUnique({
      where: { notifKey },
    });
    if (existing) {
      sentKeysCache.add(notifKey);
      return true;
    }
  } catch {
    // Tablo yoksa bellek cache kullan
  }
  return false;
}

/**
 * Bildirim gönderildi olarak işaretle
 */
async function markAsSent(notifKey: string): Promise<void> {
  sentKeysCache.add(notifKey);
  try {
    await db.sentNotification.create({
      data: { notifKey },
    });
  } catch {
    // Tablo yoksa sessizce devam et
  }
}

// GET: Tüm abonelikleri kontrol et, vakti gelenlere bildirim gönder
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testMode = searchParams.get('test') === '1';

    // Çift abonelikleri temizle
    const duplicatesRemoved = await cleanupDuplicateSubscriptions();

    const subscriptions = await db.pushSubscription.findMany();
    const now = new Date();
    let notificationsSent = 0;
    const details: string[] = [];

    if (duplicatesRemoved > 0) {
      details.push(`🧹 ${duplicatesRemoved} çift abonelik temizlendi`);
    }

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aktif abonelik bulunamadı.',
        checked: 0,
        notificationsSent: 0,
        details,
        timestamp: now.toISOString(),
      });
    }

    for (const sub of subscriptions) {
      try {
        const method = sub.method as CalculationMethod;
        const mc = METHOD_CONFIGS[method];
        if (!mc) {
          details.push(`Bilinmeyen yöntem: ${method}`);
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

        const parsedAlarms: Record<string, PrayerAlarmSetting> = JSON.parse(sub.alarms || '{}');
        const prayerOrder = getPrayerOrder(method);
        const localDateStr = getLocalDateStr(now, sub.timezone);

        // Eğer alarms boşsa, tüm vakitler için varsayılan alarm açık olsun
        const hasAnyAlarm = Object.keys(parsedAlarms).length > 0;
        const alarms: Record<string, PrayerAlarmSetting> = {};
        for (const p of prayerOrder) {
          if (parsedAlarms[p.key]) {
            alarms[p.key] = parsedAlarms[p.key];
          } else {
            alarms[p.key] = {
              vakit: p.key,
              alarm: true,
              preAlarm: {
                enabled: p.key === 'imsak',
                minutes: 15,
              },
            };
          }
        }

        // Test modu: tüm vakitleri + alarm durumunu listele
        if (testMode) {
          for (const p of prayerOrder) {
            const prayerTime = result.times[p.key];
            const diff = prayerTime.getTime() - now.getTime();
            const diffMin = Math.round(diff / 60000);
            const alarmStatus = alarms[p.key]?.alarm ? '🔔' : '🔕';
            details.push(`${alarmStatus} ${p.label}: ${formatTimeForTimezone(prayerTime, sub.timezone)} (fark: ${diffMin}dk)`);
          }
          if (!hasAnyAlarm) {
            details.push('⚠️ Alarms boştu, varsayılan alarmlar uygulandı');
          }
        }

        for (const p of prayerOrder) {
          const alarm = alarms[p.key];
          if (!alarm || !alarm.alarm) continue;

          const prayerTime = result.times[p.key];
          if (!prayerTime) continue;

          const diff = prayerTime.getTime() - now.getTime();

          // Ana bildirim: vaktin tam zamanında (0 ile -5 dakika arası)
          if (diff <= 0 && diff > -NOTIFICATION_WINDOW_MS) {
            const notifKey = `prayer-${p.key}-${localDateStr}`;

            const alreadySent = await isAlreadySent(notifKey);
            if (!alreadySent) {
              const payload = {
                title: `${p.label} Vakti`,
                body: `${p.label} vakti geldi: ${formatTimeForTimezone(prayerTime, sub.timezone)}`,
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
                notificationsSent++;
                await markAsSent(notifKey);
                details.push(`✅ ${p.label} bildirimi gönderildi`);
              } catch (pushError: any) {
                if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                  await db.pushSubscription.delete({ where: { id: sub.id } });
                  details.push(`❌ ${p.label}: Abonelik süresi dolmuş, silindi`);
                } else {
                  details.push(`❌ ${p.label}: ${pushError.message}`);
                }
              }
            }
          }

          // Pre-alarm bildirimi
          if (alarm.preAlarm?.enabled && alarm.preAlarm.minutes > 0) {
            const preAlarmTime = prayerTime.getTime() - alarm.preAlarm.minutes * 60 * 1000;
            const preAlarmDiff = preAlarmTime - now.getTime();

            if (preAlarmDiff <= 0 && preAlarmDiff > -NOTIFICATION_WINDOW_MS) {
              const notifKey = `prealarm-${p.key}-${localDateStr}`;

              const alreadySent = await isAlreadySent(notifKey);
              if (!alreadySent) {
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
                  notificationsSent++;
                  await markAsSent(notifKey);
                  details.push(`✅ ${p.label} pre-alarm gönderildi`);
                } catch (pushError: any) {
                  if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                    await db.pushSubscription.delete({ where: { id: sub.id } });
                  }
                }
              }
            }
          }
        }
      } catch (subError: any) {
        details.push(`Abonelik hatası (${sub.id}): ${subError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      checked: subscriptions.length,
      notificationsSent,
      details,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error('Bildirim gönderme hatası:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Test bildirimi gönder (manuel tetikleme)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, body: notifBody } = body;

    const subscriptions = await db.pushSubscription.findMany();

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aktif abonelik yok. Önce sitede bildirim izni verin.',
      }, { status: 400 });
    }

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      const payload = {
        title: title || '🔔 Test Bildirimi',
        body: notifBody || 'Bu bir test bildirimidir. Push bildirimler çalışıyor!',
        icon: '/favicon.ico',
        tag: `test-${Date.now()}`,
        url: '/',
      };

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
        sent++;
      } catch (pushError: any) {
        failed++;
        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          await db.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: subscriptions.length,
    });
  } catch (error: any) {
    console.error('Test bildirim hatası:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
