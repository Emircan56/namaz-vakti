import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import webpush from 'web-push';

// VAPID yapılandırması
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:prayer@suleymaniye.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

// POST: Push aboneliği kaydet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, settings, resubscribe, oldEndpoint } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Geçersiz abonelik' }, { status: 400 });
    }

    // Abonelik yenileme: eski endpoint'i sil, yenisini kaydet
    if (resubscribe && oldEndpoint && oldEndpoint !== subscription.endpoint) {
      await db.pushSubscription.deleteMany({
        where: { endpoint: oldEndpoint },
      }).catch(() => {}); // Eski kayıt yoksa sessizce devam et
    }

    // Mevcut aboneliği kontrol et
    const existing = await db.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
    });

    const data = {
      p256dh: subscription.keys?.p256dh || '',
      auth: subscription.keys?.auth || '',
      latitude: settings?.latitude ?? 41.0166,
      longitude: settings?.longitude ?? 28.9667,
      timezone: settings?.timezone ?? 3,
      city: settings?.city || 'İstanbul',
      method: settings?.method || 'suleymaniye',
      asrMadhab: settings?.asrMadhab || 'standard',
      alarms: JSON.stringify(settings?.alarms || {}),
    };

    if (existing) {
      // Güncelle
      await db.pushSubscription.update({
        where: { endpoint: subscription.endpoint },
        data,
      });
    } else {
      // Yeni kayıt
      await db.pushSubscription.create({
        data: {
          endpoint: subscription.endpoint,
          ...data,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Push subscription kayıt hatası:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Push aboneliğini kaldır
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint gerekli' }, { status: 400 });
    }

    await db.pushSubscription.deleteMany({
      where: { endpoint },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Push subscription silme hatası:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
