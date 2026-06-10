'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  SuleymaniyePrayerCalculator,
  DEFAULT_CONFIG,
  METHOD_CONFIGS,
  type PrayerTimes,
  type CalculatorConfig,
  type AsrType,
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
  minutes: number; // 5, 10, 15, 30, veya 45
}

export interface PrayerAlarmSetting {
  vakit: string;
  alarm: boolean;
  preAlarm: PreAlarmSetting;
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
  updateSettings: (partial: Partial<AppSettings>) => void;
  refreshLocation: (forceRefresh?: boolean) => Promise<void>;
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
  // SV vakitleri için varsayılan alarm ayarları
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
  // Standart vakitler için de ekle
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
};

// ────────────────────────────────────────────────────────────
// Ayar Kalıcılığı (localStorage)
// ────────────────────────────────────────────────────────────

const SETTINGS_CACHE_KEY = 'prayer_app_settings';

/** Ayarları localStorage'a kaydet */
function saveSettingsToCache(settings: AppSettings): void {
  try {
    // location alanını kaydetme (konum ayrı cache'leniyor)
    const toSave = {
      calculationMethod: settings.calculationMethod,
      asrMadhab: settings.asrMadhab,
      alarms: settings.alarms,
      useAutoLocation: settings.useAutoLocation,
      manualLatitude: settings.manualLatitude,
      manualLongitude: settings.manualLongitude,
      manualCity: settings.manualCity,
    };
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(toSave));
  } catch {
    // localStorage erişimi başarısız — sessiz devam et
  }
}

/** Ayarları localStorage'dan yükle */
function loadSettingsFromCache(): Partial<AppSettings> | null {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

/** Başlangıç ayarlarını oluştur (cache'den + varsayılan) */
function getInitialSettings(): AppSettings {
  const cached = loadSettingsFromCache();
  if (!cached) return DEFAULT_SETTINGS;

  return {
    calculationMethod: cached.calculationMethod ?? DEFAULT_SETTINGS.calculationMethod,
    asrMadhab: cached.asrMadhab ?? DEFAULT_SETTINGS.asrMadhab,
    alarms: {
      ...createDefaultAlarms(), // yeni eklenen vakitler için varsayılan
      ...(cached.alarms ?? {}), // kaydedilmiş ayarlar öncelikli
    },
    location: DEFAULT_SETTINGS.location,
    useAutoLocation: cached.useAutoLocation ?? DEFAULT_SETTINGS.useAutoLocation,
    manualLatitude: cached.manualLatitude ?? DEFAULT_SETTINGS.manualLatitude,
    manualLongitude: cached.manualLongitude ?? DEFAULT_SETTINGS.manualLongitude,
    manualCity: cached.manualCity ?? DEFAULT_SETTINGS.manualCity,
  };
}

// ────────────────────────────────────────────────────────────
// Konum Cache Yardımcıları
// ────────────────────────────────────────────────────────────

const LOCATION_CACHE_KEY = 'prayer_app_cached_location';
const LOCATION_SOURCE_CACHE_KEY = 'prayer_app_cached_location_source';

interface CachedLocation extends ResolvedLocation {
  _cachedAt: number; // epoch timestamp
}

function saveLocationToCache(loc: ResolvedLocation, source: LocationSource): void {
  try {
    const cached: CachedLocation = { ...loc, _cachedAt: Date.now() };
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(cached));
    localStorage.setItem(LOCATION_SOURCE_CACHE_KEY, source);
  } catch {
    // localStorage erişimi başarısız — sessiz devam et
  }
}

function loadLocationFromCache(): { location: ResolvedLocation; source: LocationSource } | null {
  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY);
    const source = localStorage.getItem(LOCATION_SOURCE_CACHE_KEY) as LocationSource | null;
    if (!raw) return null;
    const cached: CachedLocation = JSON.parse(raw);
    // Cache geçerliliğini kontrol et (7 gün)
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

  // Hesaplayıcıyı yönteme göre oluştur (başlangıç ayarlarından)
  const initialSettings = useRef(getInitialSettings());

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
      getMethodConfig(initialSettings.current.calculationMethod),
      initialSettings.current.asrMadhab
    )
  );

  // ── Konum Tespiti ──
  const refreshLocation = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      if (settings.useAutoLocation) {
        // Cache'den konum varsa ve zorla yenileme istenmemişse, cache kullan
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

        // 1. Önce tarayıcı Geolocation API dene
        let source: LocationSource = 'default';
        try {
          const browserLoc = await getBrowserLocation();
          lat = browserLoc.lat;
          lon = browserLoc.lon;
          source = 'browser';
        } catch {
          // Tarayıcı konumu alınamadı — sessiz devam et
        }

        // 2. Geolocation başarısız olduysa, IP bazlı fallback dene
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
          } catch {
            // IP lokasyon da başarısız — sessiz devam et
          }
        }

        // 3. Hala konum yoksa varsayılan İstanbul kullan
        if (lat === undefined || lon === undefined) {
          setCurrentLocation(DEFAULT_LOCATION);
          setLocationSource('default');
          saveLocationToCache(DEFAULT_LOCATION, 'default');
          setIsLoading(false);
          return;
        }

        // 4. Reverse geocode (şehir adı IP'den gelmediyse)
        if (!city || !country) {
          const geoInfo = await reverseGeocode(lat, lon);
          city = geoInfo.city || city;
          country = geoInfo.country || country;
        }

        const tz = getTimezoneOffset();
        const tzName = getTimezoneName();

        const resolved: ResolvedLocation = {
          latitude: lat,
          longitude: lon,
          city: city || 'Bilinmiyor',
          country: country || '',
          timezone: tz,
          timezoneName: tzName,
        };

        setCurrentLocation(resolved);
        setLocationSource(source);
        saveLocationToCache(resolved, source);
      } else {
        const tz = getTimezoneOffset();
        const tzName = getTimezoneName();
        const manual: ResolvedLocation = {
          latitude: settings.manualLatitude,
          longitude: settings.manualLongitude,
          city: settings.manualCity,
          country: '',
          timezone: tz,
          timezoneName: tzName,
        };
        setCurrentLocation(manual);
        setLocationSource('manual');
        saveLocationToCache(manual, 'manual');
      }
    } catch {
      // Herhangi bir hata durumunda sessizce varsayılana dön
      setCurrentLocation(DEFAULT_LOCATION);
    } finally {
      setIsLoading(false);
    }
  }, [settings.useAutoLocation, settings.manualLatitude, settings.manualLongitude, settings.manualCity]);

  // ── Vakit Hesaplama ──
  const calculatePrayerTimes = useCallback(() => {
    const calc = calculatorRef.current;
    const loc: Location = {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      timezone: currentLocation.timezone,
      city: currentLocation.city,
      country: currentLocation.country,
    };

    const now = new Date();
    const result = calc.calculate(now, loc);

    setPrayerTimes(result.times);
    setIsHighLatitude(result.isHighLatitude);
    setMizanApplied(result.mizanApplied);

    // Hicri tarih
    try {
      setHijriDate(gregorianToHijri(now));
    } catch {
      setHijriDate(null);
    }
  }, [currentLocation]);

  // ── Geri Sayım Güncelleme ──
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
  useEffect(() => {
    refreshLocation();
  }, []);

  useEffect(() => {
    calculatePrayerTimes();
  }, [currentLocation, settings.calculationMethod, settings.asrMadhab]);

  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [prayerTimes]);

  // ── Ayar Güncelleme ──
  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };

      // Hesap yöntemi veya ikindi mezhebi değiştiyse hesaplayıcıyı güncelle
      if (partial.calculationMethod || partial.asrMadhab) {
        const method = partial.calculationMethod ?? prev.calculationMethod;
        const config = getMethodConfig(method);
        const madhab = partial.asrMadhab ?? prev.asrMadhab;
        calculatorRef.current.updateConfig(config, madhab);
      }

      // Ayarları localStorage'a kaydet
      saveSettingsToCache(next);

      return next;
    });
  }, [getMethodConfig]);

  // ── Bildirim Zamanlayıcı ──
  // Daha önce gönderilmiş bildirimleri takip et (aynı bildirimi tekrar göndermemek için)
  const notifiedRef = useRef<Set<string>>(new Set());

  // Her gece yarısı bildirim takibini sıfırla
  useEffect(() => {
    const resetNotified = () => {
      notifiedRef.current = new Set();
    };
    // Her saat başı kontrol — gece yarısı geçildiğinde temizle
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        resetNotified();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!prayerTimes) return;

    const interval = setInterval(() => {
      const now = new Date();

      // Bildirim izni kontrolü
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      for (const p of getPrayerOrder(settings.calculationMethod)) {
        const alarm = settings.alarms[p.key];
        if (!alarm || !alarm.alarm) continue;

        const prayerTime = prayerTimes[p.key];
        const diff = prayerTime.getTime() - now.getTime();

        // Vakit bildirimi: vaktin tam zamanında veya geçmiş ama 2 saniye içinde
        const prayerNotifKey = `prayer-${p.key}-${prayerTime.getTime()}`;
        if (diff <= 0 && diff > -2000 && !notifiedRef.current.has(prayerNotifKey)) {
          notifiedRef.current.add(prayerNotifKey);
          try {
            new Notification(`${p.label} Vakti`, {
              body: `${p.label} vakti geldi: ${formatTime(prayerTime)}`,
              icon: '/favicon.ico',
              tag: `prayer-${p.key}`,
            });
          } catch {
            // Bildirim gönderilemedi — sessiz devam et
          }
        }

        // Pre-alarm bildirimi
        if (alarm.preAlarm.enabled && alarm.preAlarm.minutes > 0) {
          const preAlarmDiff = diff - alarm.preAlarm.minutes * 60 * 1000;
          const preAlarmNotifKey = `prealarm-${p.key}-${prayerTime.getTime()}-${alarm.preAlarm.minutes}`;
          if (preAlarmDiff <= 0 && preAlarmDiff > -2000 && !notifiedRef.current.has(preAlarmNotifKey)) {
            notifiedRef.current.add(preAlarmNotifKey);
            try {
              new Notification(`${p.label} Yaklaşıyor`, {
                body: `${p.label} vaktine ${alarm.preAlarm.minutes} dakika kaldı`,
                icon: '/favicon.ico',
                tag: `prealarm-${p.key}`,
              });
            } catch {
              // Bildirim gönderilemedi — sessiz devam et
            }
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [prayerTimes, settings.alarms, settings.calculationMethod]);

  const prayerOrder = getPrayerOrder(settings.calculationMethod);

  const value: PrayerContextType = {
    prayerTimes,
    settings,
    currentLocation,
    hijriDate,
    activePrayer,
    nextPrayer,
    countdown,
    isLoading,
    error,
    isHighLatitude,
    mizanApplied,
    locationSource,
    prayerOrder,
    updateSettings,
    refreshLocation,
  };

  return (
    <PrayerAppContext.Provider value={value}>
      {children}
    </PrayerAppContext.Provider>
  );
}
