/**
 * Bildirim Zamanlayıcı Mini-Servis
 * 
 * Her 30 saniyede bir Next.js API endpoint'ini çağırarak
 * vakti gelen kullanıcılara push bildirim gönderir.
 */

const NOTIFIER_URL = process.env.NOTIFIER_URL || 'http://localhost:3000/api/push/notify';
const CHECK_INTERVAL = 30_000; // 30 saniye

async function checkAndNotify(): Promise<void> {
  try {
    const response = await fetch(NOTIFIER_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[Scheduler] HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const data = await response.json();
    if (data.notificationsSent > 0) {
      console.log(`[Scheduler] ${data.notificationsSent} bildirim gönderildi (${data.checked} abonelik kontrol edildi)`);
    }
  } catch (error: any) {
    console.error(`[Scheduler] Hata: ${error.message}`);
  }
}

// Başlangıç mesajı
console.log(`[Scheduler] Bildirim zamanlayıcı başlatıldı`);
console.log(`[Scheduler] Endpoint: ${NOTIFIER_URL}`);
console.log(`[Scheduler] Kontrol aralığı: ${CHECK_INTERVAL / 1000}s`);

// İlk kontrolü hemen yap
checkAndNotify();

// Periyodik kontrol
setInterval(checkAndNotify, CHECK_INTERVAL);
