/// <reference lib="webworker" />

// Süleymaniye Vakfı Namaz Vakitleri - Service Worker
// Push bildirimlerini alıp gösterir, tarayıcı kapalıyken bile çalışır

const NOTIFICATION_ICON = '/favicon.ico';

// Push bildirimi alındığında
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const title = data.title || 'Namaz Vakti';
    const options = {
      body: data.body || '',
      icon: data.icon || NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: data.tag || 'prayer-notification',
      requireInteraction: true, // Kullanıcı kapatana kadar ekranda kal
      vibrate: [200, 100, 200], // Titreşim deseni
      data: {
        url: data.url || '/',
        prayerKey: data.prayerKey || '',
      },
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch {
    // JSON parse hatası — basit bildirim göster
    event.waitUntil(
      self.registration.showNotification('Namaz Vakti', {
        body: 'Bir namaz vakti yaklaşıyor',
        icon: NOTIFICATION_ICON,
        requireInteraction: true,
      })
    );
  }
});

// Bildirime tıklandığında
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Açık bir pencere varsa ona odaklan
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
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
// Backend'e güncel aboneliği gönder
self.addEventListener('pushsubscriptionchange', (event) => {
  const oldSubscription = event.oldSubscription;
  const newSubscription = event.newSubscription;

  if (!newSubscription) return;

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

// Aktifleştirme — eski Service Worker'ı devre dışı bırak
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Kurulum
self.addEventListener('install', () => {
  // Hemen aktifleş
  self.skipWaiting();
});
