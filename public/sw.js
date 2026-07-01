/// <reference lib="webworker" />

// Süleymaniye Vakfı Namaz Vakitleri - Service Worker v2
// Push bildirimlerini alıp gösterir, tarayıcı kapalıyken bile çalışır

const SW_VERSION = '2.0.0';
const NOTIFICATION_ICON = '/favicon.ico';

// Push bildirimi alındığında
self.addEventListener('push', (event) => {
  // Data yoksa bile bildirim göster (bazı push servisleri boş push gönderir)
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'Namaz Vakti', body: 'Bir namaz vakti yaklaşıyor' };
    }
  }

  const title = data.title || 'Namaz Vakti';
  const options = {
    body: data.body || '',
    icon: data.icon || NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    tag: data.tag || 'prayer-notification',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      prayerKey: data.prayerKey || '',
      timestamp: Date.now(),
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Bildirime tıklandığında
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Açık bir pencere varsa ona odaklan
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Yoksa yeni pencere aç
      return self.clients.openWindow(urlToOpen);
    })
  );
});

// Bildirim kapatıldığında
self.addEventListener('notificationclose', () => {
  // İstatistik veya takip için kullanılabilir
});

// Push aboneliği değiştiğinde (tarayıcı tarafından yenilendiğinde)
self.addEventListener('pushsubscriptionchange', (event) => {
  const oldSubscription = event.oldSubscription;
  const newSubscription = event.newSubscription;

  if (!newSubscription) {
    // Yeni abonelik yoksa, eski aboneliği backend'den sil
    if (oldSubscription?.endpoint) {
      fetch('/api/push', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: oldSubscription.endpoint }),
      }).catch(() => {});
    }
    return;
  }

  event.waitUntil(
    fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: newSubscription.toJSON(),
        resubscribe: true,
        oldEndpoint: oldSubscription?.endpoint,
      }),
    }).catch((err) => {
      console.error('Abonelik yenileme hatası:', err);
    })
  );
});

// Aktifleştirme — eski Service Worker'ı devre dışı bırak ve claim et
self.addEventListener('activate', (event) => {
  console.log(`[SW v${SW_VERSION}] Activate`);
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log(`[SW v${SW_VERSION}] Tüm clientlar claim edildi`);
    })
  );
});

// Kurulum — hemen aktifleş
self.addEventListener('install', () => {
  console.log(`[SW v${SW_VERSION}] Install - skipWaiting`);
  self.skipWaiting();
});

// Mesaj dinleyici — client'tan gelen mesajları işle
self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
  }
  if (event.data?.type === 'CHECK_SUBSCRIPTION') {
    // Abonelik durumunu kontrol et ve client'a bildir
    self.registration.pushManager.getSubscription().then((sub) => {
      event.source?.postMessage({
        type: 'SUBSCRIPTION_STATUS',
        hasSubscription: !!sub,
        endpoint: sub?.endpoint || null,
      });
    });
  }
});
