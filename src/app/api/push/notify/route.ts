import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import webpush from 'web-push';
import {
  SuleymaniyePrayerCalculator,
  DEFAULT_CONFIG,
  METHOD_CONFIGS,
  type CalculationMethod,
  formatTime,
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

// GET: Tüm abonelikleri kontrol et, vakti gelenlere bildirim gönder
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testMode = searchParams.get('test') === '1';

    const subscriptions = await db.pushSubscription.findMany();
    const now = new Date();
    let notificationsSent = 0;
    const details: string[] = [];

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aktif abonelik bulunamadı. Bildirim almak için önce sitede bildirim izni vermelisiniz.',
        checked: 0,
        notificationsSent: 0,
        timestamp: now.toISOString(),
      });
    }

    // Tekrar gönderim engelleme
    const sentKeys = new Set<string>();

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

        const alarms: Record<string, PrayerAlarmSetting> = JSON.parse(sub.alarms || '{}');
        const prayerOrder = getPrayerOrder(method);
        const localDateStr = getLocalDateStr(now, sub.timezone);

        // Test modu: tüm vakitleri listele
        if (testMode) {
          for (const p of prayerOrder) {
            const prayerTime = result.times[p.key];
            const diff = prayerTime.getTime() - now.getTime();
            const diffMin = Math.round(diff / 60000);
            details.push(`${p.label}: ${formatTime(prayerTime)} (fark: ${diffMin}dk)`);
          }
        }

        for (const p of prayerOrder) {
          const alarm = alarms[p.key];
          if (!alarm || !alarm.alarm) continue;

          const prayerTime = result.times[p.key];
          if (!prayerTime) continue;

          const diff = prayerTime.getTime() - now.getTime();

          // Ana bildirim: vaktin tam zamanında (0 ile -90 saniye arası)
          if (diff <= 0 && diff > -90000) {
            const notifKey = `prayer-${p.key}-${localDateStr}`;

            if (!sentKeys.has(notifKey)) {
              sentKeys.add(notifKey);
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
                notificationsSent++;
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

            if (preAlarmDiff <= 0 && preAlarmDiff > -90000) {
              const notifKey = `prealarm-${p.key}-${localDateStr}`;

              if (!sentKeys.has(notifKey)) {
                sentKeys.add(notifKey);
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
