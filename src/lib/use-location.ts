/**
 * Konum tespiti ve reverse geocoding yardımcıları
 */

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  timezone: number;
  timezoneName: string;
}

/**
 * Tarayıcı konum API'si ile koordinat al
 */
export function getBrowserLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation desteklenmiyor'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: false,   // Hızlı sonuç için high accuracy kapat
        timeout: 5000,               // 5 saniye zaman aşımı
        maximumAge: 600000,          // 10 dakika cache
      }
    );
  });
}

/**
 * IP bazlı konum tespiti (fallback)
 */
export async function getIPLocation(): Promise<{ lat: number; lon: number; city: string; country: string } | null> {
  try {
    const res = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.latitude && data.longitude) {
      return {
        lat: data.latitude,
        lon: data.longitude,
        city: data.city || '',
        country: data.country_name || '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Timezone offset hesaplama (saat cinsinden)
 */
export function getTimezoneOffset(): number {
  const now = new Date();
  return -now.getTimezoneOffset() / 60;
}

export function getTimezoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Europe/Istanbul';
  }
}

/**
 * Koordinatlardan şehir/ülke bilgisi al (üyelik gerektirmeyen API)
 */
export async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; country: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&accept-language=tr`,
      {
        headers: {
          'User-Agent': 'SuleymaniyePrayerApp/1.0',
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    const data = await res.json();
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.county || addr.state || '';
    const country = addr.country || '';
    return { city, country };
  } catch {
    return { city: '', country: '' };
  }
}

/**
 * Varsayılan konum (İstanbul / Süleymaniye)
 */
export const DEFAULT_LOCATION: ResolvedLocation = {
  latitude: 41.0166,
  longitude: 28.9667,
  city: 'İstanbul',
  country: 'Türkiye',
  timezone: 3,
  timezoneName: 'Europe/Istanbul',
};
