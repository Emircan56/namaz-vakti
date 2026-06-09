'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  SuleymaniyePrayerCalculator,
  DEFAULT_CONFIG,
  type PrayerTimes,
  type CalculatorConfig,
  type AsrType,
  gregorianToHijri,
  getActivePrayer,
  formatTime,
  formatCountdown,
  PRAYER_ORDER,
  type PrayerInfo,
  type Location,
} from './prayer-calculator';
import {
  getBrowserLocation,
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
  minutes: number; // 15, 30, veya 45
}

export interface PrayerAlarmSetting {
  vakit: string;
  alarm: boolean;
  preAlarm: PreAlarmSetting;
}

export interface AppSettings {
  asrType: AsrType;
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
  updateSettings: (partial: Partial<AppSettings>) => void;
  refreshLocation: () => Promise<void>;
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
  for (const p of PRAYER_ORDER) {
    alarms[p.key] = {
      vakit: p.key,
      alarm: true,
      preAlarm: {
        enabled: p.key === 'seher' || p.key === 'imsak',
        minutes: p.key === 'seher' ? 30 : 15,
      },
    };
  }
  return alarms;
}

const DEFAULT_SETTINGS: AppSettings = {
  asrType: 'sani',
  alarms: createDefaultAlarms(),
  location: DEFAULT_LOCATION,
  useAutoLocation: true,
  manualLatitude: 41.0166,
  manualLongitude: 28.9667,
  manualCity: 'İstanbul',
};

// ────────────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────────────

export function PrayerAppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
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

  const calculatorRef = useRef<SuleymaniyePrayerCalculator>(
    new SuleymaniyePrayerCalculator({ asrType: DEFAULT_SETTINGS.asrType })
  );

  // ── Konum Tespiti ──
  const refreshLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (settings.useAutoLocation) {
        const { lat, lon } = await getBrowserLocation();
        const geoInfo = await reverseGeocode(lat, lon);
        const tz = getTimezoneOffset();
        const tzName = getTimezoneName();

        const loc: ResolvedLocation = {
          latitude: lat,
          longitude: lon,
          city: geoInfo.city,
          country: geoInfo.country,
          timezone: tz,
          timezoneName: tzName,
        };

        setCurrentLocation(loc);
      } else {
        const tz = getTimezoneOffset();
        const tzName = getTimezoneName();
        setCurrentLocation({
          latitude: settings.manualLatitude,
          longitude: settings.manualLongitude,
          city: settings.manualCity,
          country: '',
          timezone: tz,
          timezoneName: tzName,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Konum alınamadı, varsayılan kullanılıyor');
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
    const result = getActivePrayer(prayerTimes, now);

    if (result) {
      setActivePrayer(result.active);
      setNextPrayer(result.next);
      setCountdown(formatCountdown(result.timeUntilNext));
    }
  }, [prayerTimes]);

  // ── Effects ──
  useEffect(() => {
    refreshLocation();
  }, []);

  useEffect(() => {
    calculatePrayerTimes();
  }, [currentLocation, settings.asrType]);

  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [prayerTimes]);

  // ── Ayar Güncelleme ──
  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      
      // Asr tipi değiştiyse hesaplayıcıyı güncelle
      if (partial.asrType) {
        calculatorRef.current.updateConfig({ asrType: partial.asrType });
      }

      return next;
    });
  }, []);

  // ── Bildirim Zamanlayıcı ──
  useEffect(() => {
    if (!prayerTimes) return;

    // Her saniye kontrol et
    const interval = setInterval(() => {
      const now = new Date();
      
      for (const p of PRAYER_ORDER) {
        const alarm = settings.alarms[p.key];
        if (!alarm || !alarm.alarm) continue;

        const prayerTime = prayerTimes[p.key];
        const diff = prayerTime.getTime() - now.getTime();

        // Vakit geldiğinde bildirim
        if (diff > 0 && diff < 1000) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`${p.label} Vakti`, {
              body: `${p.label} vakti geldi: ${formatTime(prayerTime)}`,
              icon: '/favicon.ico',
              tag: `prayer-${p.key}`,
            });
          }
        }

        // Pre-alarm
        if (alarm.preAlarm.enabled) {
          const preAlarmTime = diff - alarm.preAlarm.minutes * 60 * 1000;
          if (preAlarmTime > 0 && preAlarmTime < 1000) {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`${p.label} Yaklaşıyor`, {
                body: `${p.label} vaktine ${alarm.preAlarm.minutes} dakika kaldı`,
                icon: '/favicon.ico',
                tag: `prealarm-${p.key}`,
              });
            }
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [prayerTimes, settings.alarms]);

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
    updateSettings,
    refreshLocation,
  };

  return (
    <PrayerAppContext.Provider value={value}>
      {children}
    </PrayerAppContext.Provider>
  );
}
