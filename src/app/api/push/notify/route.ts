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

// GET: Tüm abonelikleri kontrol et, vakti gelenlere bildirim gönder
export async function GET(request: NextRequest) {
  try {
    const subscriptions = await db.pushSubscription.findMany();
    const now = new Date();
    let notificationsSent = 0;

    for (const sub of subscriptions) {
      try {
        // Kullanıcının ayarlarına göre vakitleri hesapla
        const method = sub.method as CalculationMethod;
        const mc = METHOD_CONFIGS[method];
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

        for (const p of prayerOrder) {
          const alarm = alarms[p.key];
          if (!alarm || !alarm.alarm) continue;

          const prayerTime = result.times[p.key];
          const diff = prayerTime.getTime() - now.getTime();

          // Ana bildirim: vaktin tam zamanında (±60 saniye)
          if (diff <= 0 && diff > -60000) {
            const payload = {
              title: `${p.label} Vakti`,
              body: `${p.label} vakti geldi: ${formatTime(prayerTime)}`,
              icon: '/favicon.ico',
              tag: `prayer-${p.key}`,
              prayerKey: p.key,
              url: '/',
            };

            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                JSON.stringify(payload)
              );
              notificationsSent++;
            } catch (pushError: any) {
              // Abonelik geçersizse sil
              if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                await db.pushSubscription.delete({ where: { id: sub.id } });
              }
            }
          }

          // Pre-alarm bildirimi
          if (alarm.preAlarm?.enabled && alarm.preAlarm.minutes > 0) {
            const preAlarmDiff = diff - alarm.preAlarm.minutes * 60 * 1000;
            if (preAlarmDiff <= 0 && preAlarmDiff > -60000) {
              const payload = {
                title: `${p.label} Yaklaşıyor`,
                body: `${p.label} vaktine ${alarm.preAlarm.minutes} dakika kaldı`,
                icon: '/favicon.ico',
                tag: `prealarm-${p.key}`,
                prayerKey: p.key,
                url: '/',
              };

              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                  },
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
        console.error(`Abonelik işleme hatası (${sub.id}):`, subError);
      }
    }

    return NextResponse.json({
      success: true,
      checked: subscriptions.length,
      notificationsSent,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error('Bildirim gönderme hatası:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
