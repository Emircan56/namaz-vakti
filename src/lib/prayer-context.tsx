'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  SuleymaniyePrayerCalculator,
  DEFAULT_CONFIG,
  METHOD_CONFIGS,
  type PrayerTimes,
  type CalculatorConfig,
  type CalculationMethod,
  gregorianToHijri,
  getActivePrayer,
  getPrayerOrder,
  formatTime,
  formatCountdown,
  PRAYER_ORDER_SV,
  PRAYER_ORDER_STANDARD,
  type PrayerInfo,
  type Location,
  type PrayerAlarmSetting,
} from './prayer-calculator';
import {
  getBrowserLocation,
  getIPLocation,
  getTimezoneOffset,
  getTimezoneName,
  reverseGeocode,
  DEFAULT_LOCATION,
  type ResolvedLocation,
} from './use-location';

// ────────────────────────────────────────────────────────────
// Ayar Tipleri
// ────────────────────────────────────────────────────────────

export interface PreAlarmSetting {
  enabled: boolean;
  minutes: number;
}

export type AsrMadhab = 'standard' | 'hanafi';

export interface AppSettings {
  calculationMethod: CalculationMethod;
  asrMadhab: AsrMadhab;
  alarms: Record<string, PrayerAlarmSetting>;
  location: ResolvedLocation;
  useAutoLocation: boolean;
  manualLatitude: number;
  manualLongitude: number;
  manualCity: string;
  pushEnabled: boolean;
}

// ────────────────────────────────────────────────────────────
// Context Tipleri
// ────────────────────────────────────────────────────────────

export type LocationSource = 'browser' | 'ip' | 'default' | 'manual';

interface PrayerContextType {
  prayerTimes: PrayerTimes | null;
  settings: AppSettings;
  currentLocation: ResolvedLocation;
  hijriDate: ReturnType<typeof gregorianToHijri> | null;
  activePrayer: PrayerInfo | null;
  nextPrayer: PrayerInfo | null;
  countdown: string;
  isLoading: boolean;
  error: string | null;
  isHighLatitude: boolean;
  mizanApplied: boolean;
  locationSource: LocationSource;
  prayerOrder: PrayerInfo[];
  pushSupported: boolean;
  pushPermission: NotificationPermission | 'default';
  updateSettings: (partial: Partial<AppSettings>) => void;
  refreshLocation: (forceRefresh?: boolean) => Promise<void>;
  enablePushNotifications: () => Promise<boolean>;
  disablePushNotifications: () => Promise<void>;
}

const PrayerAppContext = createContext<PrayerContextType | null>(null);

export function usePrayerApp() {
  const ctx = useContext(PrayerAppContext);
  if (!ctx) throw new Error('usePrayerApp must be used within PrayerAppProvider');
  return ctx;
}

// ────────────────────────────────────────────────────────────
// Varsayılan Ayarlar
// ────────────────────────────────────────────────────────────

function createDefaultAlarms(): Record<string, PrayerAlarmSetting> {
  const alarms: Record<string, PrayerAlarmSetting> = {};
  for (const p of PRAYER_ORDER_SV) {
    alarms[p.key] = {
      vakit: p.key,
      alarm: true,
      preAlarm: {
        enabled: p.key === 'seher' || p.key === 'imsak',
        minutes: p.key === 'seher' ? 30 : 15,
      },
    };
  }
  for (const p of PRAYER_ORDER_STANDARD) {
    if (!alarms[p.key]) {
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
  return alarms;
}

const DEFAULT_SETTINGS: AppSettings = {
  calculationMethod: 'suleymaniye',
  asrMadhab: 'standard',
  alarms: createDefaultAlarms(),
  location: DEFAULT_LOCATION,
  useAutoLocation: true,
  manualLatitude: 41.0166,
  manualLongitude: 28.9667,
  manualCity: 'İstanbul',
  pushEnabled: false,
};

// ────────────────────────────────────────────────────────────
// Ayar Kalıcılığı (localStorage)
// ────────────────────────────────────────────────────────────

const SETTINGS_CACHE_KEY = 'prayer_app_settings';

function saveSettingsToCache(settings: AppSettings): void {
  try {
    const toSave = {
      calculationMethod: settings.calculationMethod,
      asrMadhab: settings.asrMadhab,
      alarms: settings.alarms,
      useAutoLocation: settings.useAutoLocation,
      manualLatitude: settings.manualLatitude,
      manualLongitude: settings.manualLongitude,
      manualCity: settings.manualCity,
      pushEnabled: settings.pushEnabled,
    };
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(toSave));
  } catch {}
}

function loadSettingsFromCache(): Partial<AppSettings> | null {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getInitialSettings(): AppSettings {
  const cached = loadSettingsFromCache();
  if (!cached) return DEFAULT_SETTINGS;
  return {
    calculationMethod: cached.calculationMethod ?? DEFAULT_SETTINGS.calculationMethod,
    asrMadhab: cached.asrMadhab ?? DEFAULT_SETTINGS.asrMadhab,
    alarms: { ...createDefaultAlarms(), ...(cached.alarms ?? {}) },
    location: DEFAULT_SETTINGS.location,
    useAutoLocation: cached.useAutoLocation ?? DEFAULT_SETTINGS.useAutoLocation,
    manualLatitude: cached.manualLatitude ?? DEFAULT_SETTINGS.manualLatitude,
    manualLongitude: cached.manualLongitude ?? DEFAULT_SETTINGS.manualLongitude,
    manualCity: cached.manualCity ?? DEFAULT_SETTINGS.manualCity,
    pushEnabled: cached.pushEnabled ?? DEFAULT_SETTINGS.pushEnabled,
  };
}

// ────────────────────────────────────────────────────────────
// Konum Cache Yardımcıları
// ────────────────────────────────────────────────────────────

const LOCATION_CACHE_KEY = 'prayer_app_cached_location';
const LOCATION_SOURCE_CACHE_KEY = 'prayer_app_cached_location_source';

interface CachedLocation extends ResolvedLocation {
  _cachedAt: number;
}

function saveLocationToCache(loc: ResolvedLocation, source: LocationSource): void {
  try {
    const cached: CachedLocation = { ...loc, _cachedAt: Date.now() };
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(cached));
    localStorage.setItem(LOCATION_SOURCE_CACHE_KEY, source);
  } catch {}
}

function loadLocationFromCache(): { location: ResolvedLocation; source: LocationSource } | null {
  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY);
    const source = localStorage.getItem(LOCATION_SOURCE_CACHE_KEY) as LocationSource | null;
    if (!raw) return null;
    const cached: CachedLocation = JSON.parse(raw);
    if (cached._cachedAt && Date.now() - cached._cachedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(LOCATION_CACHE_KEY);
      localStorage.removeItem(LOCATION_SOURCE_CACHE_KEY);
      return null;
    }
    const { _cachedAt, ...loc } = cached;
    return { location: loc as ResolvedLocation, source: (source as LocationSource) || 'default' };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Push Bildirim Yardımcıları
// ────────────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ────────────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────────────

export function PrayerAppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(getInitialSettings);
  const [currentLocation, setCurrentLocation] = useState<ResolvedLocation>(DEFAULT_LOCATION);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [hijriDate, setHijriDate] = useState<ReturnType<typeof gregorianToHijri> | null>(null);
  const [activePrayer, setActivePrayer] = useState<PrayerInfo | null>(null);
  const [nextPrayer, setNextPrayer] = useState<PrayerInfo | null>(null);
  const [countdown, setCountdown] = useState('00:00:00');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHighLatitude, setIsHighLatitude] = useState(false);
  const [mizanApplied, setMizanApplied] = useState(false);
  const [locationSource, setLocationSource] = useState<LocationSource>('default');
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [pushSupported, setPushSupported] = useState(false);

  const initialSettingsRef = useRef(getInitialSettings());
  const pushSubscriptionRef = useRef<PushSubscription | null>(null);

  const getMethodConfig = useCallback((method: CalculationMethod): Partial<CalculatorConfig> => {
    const mc = METHOD_CONFIGS[method];
    return {
      method,
      imsakAngle: mc.imsakAngle ?? DEFAULT_CONFIG.imsakAngle,
      yatsiAngle: mc.yatsiAngle ?? DEFAULT_CONFIG.yatsiAngle,
      asrType: mc.asrType ?? DEFAULT_CONFIG.asrType,
      temkin: mc.temkin ?? DEFAULT_CONFIG.temkin,
    };
  }, []);

  const calculatorRef = useRef<SuleymaniyePrayerCalculator>(
    new SuleymaniyePrayerCalculator(
      getMethodConfig(initialSettingsRef.current.calculationMethod),
      initialSettingsRef.current.asrMadhab
    )
  );

  // Push desteği kontrolü (client-side only — hidrasyon uyumu için useEffect)
  useEffect(() => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      VAPID_PUBLIC_KEY !== '';
    setPushSupported(supported);
  }, []);

  // Push aboneliğini sayfa yüklendiğinde senkronize et (DB kaybını önle)
  useEffect(() => {
    if (!pushSupported || !settings.pushEnabled) return;
    const resyncPush = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          pushSubscriptionRef.current = existingSub;
          // Her sayfa yüklendiğinde aboneliği backend'e tekrar gönder (DB'de yoksa oluşturur)
          await syncPushSubscription(existingSub, currentLocation, settings);
          console.log('[Push] Abonelik senkronize edildi');
        }
      } catch (err) {
        console.error('[Push] Abonelik senkronizasyon hatası:', err);
      }
    };
    // Konum yüklendikten sonra senkronize et
    if (!isLoading && currentLocation.latitude !== 0) {
      resyncPush();
    }
  }, [pushSupported, settings.pushEnabled, isLoading, currentLocation.latitude]);

  // ── Service Worker Kaydı ──
  useEffect(() => {
    if (!pushSupported) return;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        // Mevcut aboneliği kontrol et
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          pushSubscriptionRef.current = existingSub;
        }
      } catch (err) {
        console.error('SW kayıt hatası:', err);
      }
    };

    registerSW();
  }, [pushSupported]);

  // ── Push Aboneliğini Backend'e Gönder ──
  const syncPushSubscription = useCallback(async (
    subscription: PushSubscription,
    loc: ResolvedLocation,
    sett: AppSettings
  ) => {
    try {
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          settings: {
            latitude: loc.latitude,
            longitude: loc.longitude,
            timezone: loc.timezone,
            city: loc.city,
            method: sett.calculationMethod,
            asrMadhab: sett.asrMadhab,
            alarms: sett.alarms,
          },
        }),
      });
    } catch (err) {
      console.error('Push abonelik senkronizasyon hatası:', err);
    }
  }, []);

  // ── Push Bildirimleri Etkinleştir ──
  const enablePushNotifications = useCallback(async (): Promise<boolean> => {
    if (!pushSupported) return false;

    try {
      // Bildirim izni iste
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== 'granted') return false;

      // Service Worker ready bekle
      const registration = await navigator.serviceWorker.ready;

      // Push aboneliği oluştur
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      pushSubscriptionRef.current = subscription;

      // Backend'e gönder
      await syncPushSubscription(subscription, currentLocation, settings);

      return true;
    } catch (err) {
      console.error('Push bildirim etkinleştirme hatası:', err);
      return false;
    }
  }, [pushSupported, currentLocation, settings, syncPushSubscription]);

  // ── Push Bildirimleri Devre Dışı Bırak ──
  const disablePushNotifications = useCallback(async () => {
    try {
      if (pushSubscriptionRef.current) {
        // Backend'den kaldır
        await fetch('/api/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: pushSubscriptionRef.current.endpoint }),
        });

        // Tarayıcıdan aboneliği kaldır
        await pushSubscriptionRef.current.unsubscribe();
        pushSubscriptionRef.current = null;
      }
    } catch (err) {
      console.error('Push bildirim kapatma hatası:', err);
    }
  }, []);

  // ── Ayarlar veya konum değiştiğinde push aboneliğini güncelle ──
  useEffect(() => {
    if (!settings.pushEnabled || !pushSubscriptionRef.current) return;
    syncPushSubscription(pushSubscriptionRef.current, currentLocation, settings);
  }, [settings.calculationMethod, settings.asrMadhab, settings.alarms, currentLocation, settings.pushEnabled, syncPushSubscription]);

  // ── Konum Tespiti ──
  const refreshLocation = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      if (settings.useAutoLocation) {
        if (!forceRefresh) {
          const cached = loadLocationFromCache();
          if (cached) {
            setCurrentLocation(cached.location);
            setLocationSource(cached.source);
            setIsLoading(false);
            return;
          }
        }

        let lat: number | undefined;
        let lon: number | undefined;
        let city = '';
        let country = '';
        let source: LocationSource = 'default';

        try {
          const browserLoc = await getBrowserLocation();
          lat = browserLoc.lat;
          lon = browserLoc.lon;
          source = 'browser';
        } catch {}

        if (lat === undefined || lon === undefined) {
          try {
            const ipLoc = await getIPLocation();
            if (ipLoc) {
              lat = ipLoc.lat;
              lon = ipLoc.lon;
              city = ipLoc.city;
              country = ipLoc.country;
              source = 'ip';
            }
          } catch {}
        }

        if (lat === undefined || lon === undefined) {
          setCurrentLocation(DEFAULT_LOCATION);
          setLocationSource('default');
          saveLocationToCache(DEFAULT_LOCATION, 'default');
          setIsLoading(false);
          return;
        }

        if (!city || !country) {
          const geoInfo = await reverseGeocode(lat, lon);
          city = geoInfo.city || city;
          country = geoInfo.country || country;
        }

        const tz = getTimezoneOffset();
        const tzName = getTimezoneName();

        const resolved: ResolvedLocation = {
          latitude: lat, longitude: lon,
          city: city || 'Bilinmiyor', country: country || '',
          timezone: tz, timezoneName: tzName,
        };

        setCurrentLocation(resolved);
        setLocationSource(source);
        saveLocationToCache(resolved, source);
      } else {
        const tz = getTimezoneOffset();
        const tzName = getTimezoneName();
        const manual: ResolvedLocation = {
          latitude: settings.manualLatitude, longitude: settings.manualLongitude,
          city: settings.manualCity, country: '',
          timezone: tz, timezoneName: tzName,
        };
        setCurrentLocation(manual);
        setLocationSource('manual');
        saveLocationToCache(manual, 'manual');
      }
    } catch {
      setCurrentLocation(DEFAULT_LOCATION);
    } finally {
      setIsLoading(false);
    }
  }, [settings.useAutoLocation, settings.manualLatitude, settings.manualLongitude, settings.manualCity]);

  // ── Vakit Hesaplama ──
  const calculatePrayerTimes = useCallback(() => {
    const calc = calculatorRef.current;
    const loc: Location = {
      latitude: currentLocation.latitude, longitude: currentLocation.longitude,
      timezone: currentLocation.timezone, city: currentLocation.city, country: currentLocation.country,
    };
    const now = new Date();
    const result = calc.calculate(now, loc);
    setPrayerTimes(result.times);
    setIsHighLatitude(result.isHighLatitude);
    setMizanApplied(result.mizanApplied);
    try { setHijriDate(gregorianToHijri(now)); } catch { setHijriDate(null); }
  }, [currentLocation]);

  // ── Geri Sayım ──
  const updateCountdown = useCallback(() => {
    if (!prayerTimes) return;
    const now = new Date();
    const result = getActivePrayer(prayerTimes, now, settings.calculationMethod);
    if (result) {
      setActivePrayer(result.active);
      setNextPrayer(result.next);
      setCountdown(formatCountdown(result.timeUntilNext));
    }
  }, [prayerTimes, settings.calculationMethod]);

  // ── Effects ──
  useEffect(() => { refreshLocation(); }, []);

  useEffect(() => { calculatePrayerTimes(); }, [currentLocation, settings.calculationMethod, settings.asrMadhab]);

  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [prayerTimes]);

  // Bildirim iznini takip et
  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  // ── Ayar Güncelleme ──
  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };

      if (partial.calculationMethod || partial.asrMadhab) {
        const method = partial.calculationMethod ?? prev.calculationMethod;
        const config = getMethodConfig(method);
        const madhab = partial.asrMadhab ?? prev.asrMadhab;
        calculatorRef.current.updateConfig(config, madhab);
      }

      saveSettingsToCache(next);
      return next;
    });
  }, [getMethodConfig]);

  // ── Tarayıcı İçi Bildirim (sekme açıkken fallback) ──
  // Push aboneliği aktifse sunucu zaten push bildirimi göndereceği için
  // lokal bildirim göstermiyoruz — aksi takdirde çift bildirim oluşur.
  // Push yoksa (VAPID key yok, tarayıcı desteklemiyor vb.) lokal bildirim fallback olarak çalışır.
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        notifiedRef.current = new Set();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!prayerTimes) return;

    // Lokal bildirim HER ZAMAN çalışsın (push server-side cron gecikmeli olabilir)
    const hasPushSubscription = settings.pushEnabled && !!pushSubscriptionRef.current;

    const interval = setInterval(() => {
      const now = new Date();
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      for (const p of getPrayerOrder(settings.calculationMethod)) {
        const alarm = settings.alarms[p.key];
        if (!alarm || !alarm.alarm) continue;

        const prayerTime = prayerTimes[p.key];
        const diff = prayerTime.getTime() - now.getTime();

        const prayerNotifKey = `prayer-${p.key}-${prayerTime.getTime()}`;
        if (diff <= 0 && diff > -120000 && !notifiedRef.current.has(prayerNotifKey)) {
          notifiedRef.current.add(prayerNotifKey);
          // Service Worker üzerinden göster (daha güvenilir)
          navigator.serviceWorker?.ready.then(reg => {
            reg.showNotification(`${p.label} Vakti`, {
              body: `${p.label} vakti geldi: ${formatTime(prayerTime)}`,
              icon: '/favicon.ico',
              tag: `prayer-${p.key}`,
              requireInteraction: true,
            });
          }).catch(() => {
            // Fallback: doğrudan Notification API
            try {
              new Notification(`${p.label} Vakti`, {
                body: `${p.label} vakti geldi: ${formatTime(prayerTime)}`,
                icon: '/favicon.ico',
                tag: `prayer-${p.key}`,
              });
            } catch {}
          });
        }

        if (alarm.preAlarm.enabled && alarm.preAlarm.minutes > 0) {
          const preAlarmTime = prayerTime.getTime() - alarm.preAlarm.minutes * 60 * 1000;
          const preAlarmDiff = preAlarmTime - now.getTime();
          const preAlarmNotifKey = `prealarm-${p.key}-${prayerTime.getTime()}-${alarm.preAlarm.minutes}`;
          if (preAlarmDiff <= 0 && preAlarmDiff > -120000 && !notifiedRef.current.has(preAlarmNotifKey)) {
            notifiedRef.current.add(preAlarmNotifKey);
            navigator.serviceWorker?.ready.then(reg => {
              reg.showNotification(`${p.label} Yaklaşıyor`, {
                body: `${p.label} vaktine ${alarm.preAlarm.minutes} dakika kaldı`,
                icon: '/favicon.ico',
                tag: `prealarm-${p.key}`,
                requireInteraction: true,
              });
            }).catch(() => {
              try {
                new Notification(`${p.label} Yaklaşıyor`, {
                  body: `${p.label} vaktine ${alarm.preAlarm.minutes} dakika kaldı`,
                  icon: '/favicon.ico',
                  tag: `prealarm-${p.key}`,
                });
              } catch {}
            });
          }
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [prayerTimes, settings.alarms, settings.calculationMethod, settings.pushEnabled]);

  const prayerOrder = getPrayerOrder(settings.calculationMethod);

  const value: PrayerContextType = {
    prayerTimes, settings, currentLocation, hijriDate,
    activePrayer, nextPrayer, countdown,
    isLoading, error, isHighLatitude, mizanApplied,
    locationSource, prayerOrder,
    pushSupported, pushPermission,
    updateSettings, refreshLocation,
    enablePushNotifications, disablePushNotifications,
  };

  return (
    <PrayerAppContext.Provider value={value}>
      {children}
    </PrayerAppContext.Provider>
  );
}
