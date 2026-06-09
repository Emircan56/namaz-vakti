'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PrayerAppProvider,
  usePrayerApp,
} from '@/lib/prayer-context';
import {
  PRAYER_ORDER,
  formatTime,
  type PrayerTimes,
  type PrayerInfo,
} from '@/lib/prayer-calculator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Settings,
  MapPin,
  Moon,
  Sun,
  Bell,
  BellOff,
  ChevronRight,
  Info,
  RefreshCw,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────
// Ana Uygulama Bileşeni
// ────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <PrayerAppProvider>
      <PrayerApp />
    </PrayerAppProvider>
  );
}

function PrayerApp() {
  const {
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
  } = usePrayerApp();

  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return saved === 'dark' || (!saved && prefersDark);
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Dark mode sync with DOM
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleDark = useCallback(() => {
    setIsDark((prev: boolean) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  // Saat güncelleme
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Bildirim izni iste
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col islamic-pattern">
      {/* Üst Bilgi Çubuğu */}
      <Header
        location={currentLocation}
        hijriDate={hijriDate}
        currentTime={currentTime}
        isDark={isDark}
        onToggleDark={toggleDark}
        onRefresh={refreshLocation}
        error={error}
      />

      {/* Ana İçerik */}
      <main className="flex-1 flex flex-col items-center px-4 py-4 gap-4 max-w-lg mx-auto w-full">
        {/* Geri Sayım Kartı */}
        <CountdownCard
          activePrayer={activePrayer}
          nextPrayer={nextPrayer}
          countdown={countdown}
          prayerTimes={prayerTimes}
          isHighLatitude={isHighLatitude}
          mizanApplied={mizanApplied}
        />

        {/* Vakitler Listesi */}
        <PrayerTimesList
          prayerTimes={prayerTimes}
          activePrayer={activePrayer}
          nextPrayer={nextPrayer}
          settings={settings}
          updateSettings={updateSettings}
        />
      </main>

      {/* Alt Bilgi */}
      <Footer />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Yüklenme Ekranı
// ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 islamic-pattern">
      <div className="relative">
        <div className="text-7xl mb-2 animate-pulse">🕌</div>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-16 h-1 bg-islamic/30 rounded-full" />
      </div>
      <div className="text-xl font-semibold text-islamic mt-2">Namaz Vakitleri</div>
      <div className="text-sm text-muted-foreground">Konum tespit ediliyor...</div>
      <div className="flex gap-1.5 mt-4">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-islamic animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Üst Bilgi Çubuğu
// ────────────────────────────────────────────────────────────

function Header({
  location,
  hijriDate,
  currentTime,
  isDark,
  onToggleDark,
  onRefresh,
  error,
}: {
  location: { city: string; country: string; timezoneName: string };
  hijriDate: { day: number; month: number; year: number; monthName: string } | null;
  currentTime: Date;
  isDark: boolean;
  onToggleDark: () => void;
  onRefresh: () => void;
  error: string | null;
}) {
  return (
    <header className="w-full bg-islamic text-islamic-foreground shadow-lg relative overflow-hidden">
      {/* Dekoratif geometrik desen */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-32 h-32 border-l-2 border-b-2 border-current rotate-45 translate-x-16 -translate-y-8" />
        <div className="absolute bottom-0 left-0 w-24 h-24 border-r-2 border-t-2 border-current rotate-45 -translate-x-6 translate-y-6" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-3">
        {/* Konum ve Butonlar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium truncate">
              {location.city}{location.country ? `, ${location.country}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-islamic-foreground/80 hover:text-islamic-foreground hover:bg-islamic-light/20"
              onClick={onRefresh}
              aria-label="Konumu yenile"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-islamic-foreground/80 hover:text-islamic-foreground hover:bg-islamic-light/20"
              onClick={onToggleDark}
              aria-label={isDark ? 'Aydınlık mod' : 'Karanlık mod'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Tarihler */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs opacity-80">
            {currentTime.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          {hijriDate && (
            <span className="text-xs opacity-80 font-medium">
              {hijriDate.day} {hijriDate.monthName} {hijriDate.year}
            </span>
          )}
        </div>

        {/* Saat */}
        <div className="text-center mt-2">
          <span className="text-2xl font-mono tracking-[0.2em] font-light">
            {currentTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {error && (
          <div className="text-xs mt-1.5 opacity-60 text-center bg-islamic-light/10 rounded px-2 py-0.5">
            {error}
          </div>
        )}
      </div>
    </header>
  );
}

// ────────────────────────────────────────────────────────────
// Dairesel İlerleme Göstergesi
// ────────────────────────────────────────────────────────────

function CircularProgress({
  value,
  size = 120,
  strokeWidth = 4,
  children,
}: {
  value: number; // 0-1
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - value * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Arka plan halkası */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-islamic/10"
        />
        {/* İlerleme halkası */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-islamic transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Geri Sayım Kartı
// ────────────────────────────────────────────────────────────

function CountdownCard({
  activePrayer,
  nextPrayer,
  countdown,
  prayerTimes,
  isHighLatitude,
  mizanApplied,
}: {
  activePrayer: PrayerInfo | null;
  nextPrayer: PrayerInfo | null;
  countdown: string;
  prayerTimes: PrayerTimes | null;
  isHighLatitude: boolean;
  mizanApplied: boolean;
}) {
  // İlerleme hesaplama (aktif vaktin ne kadarı geçti)
  const progress = useMemo(() => {
    if (!prayerTimes || !activePrayer || !nextPrayer) return 0;
    const activeTime = prayerTimes[activePrayer.key];
    const nextTime = prayerTimes[nextPrayer.key];
    const now = new Date();
    const total = nextTime.getTime() - activeTime.getTime();
    const elapsed = now.getTime() - activeTime.getTime();
    if (total <= 0) return 0;
    return Math.max(0, Math.min(1, elapsed / total));
  }, [prayerTimes, activePrayer, nextPrayer]);

  return (
    <Card className="w-full border-islamic/20 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-br from-islamic/5 via-transparent to-gold/5">
        <CardContent className="p-5">
          <div className="flex items-center gap-5">
            {/* Dairesel İlerleme */}
            <div className="shrink-0">
              <CircularProgress value={progress} size={110} strokeWidth={3}>
                <div className="text-center">
                  <div className="text-2xl font-mono font-bold text-islamic countdown-pulse tracking-wider">
                    {countdown.slice(0, 5)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">kaldı</div>
                </div>
              </CircularProgress>
            </div>

            {/* Vakit Bilgisi */}
            <div className="flex-1 min-w-0">
              {activePrayer && (
                <div className="mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                    İçinde bulunulan vakit
                  </div>
                  <div className="text-lg font-bold text-islamic truncate">
                    {activePrayer.icon} {activePrayer.label}
                  </div>
                </div>
              )}

              {nextPrayer && prayerTimes && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                    Sıradaki vakit
                  </div>
                  <div className="text-base font-semibold text-foreground">
                    {nextPrayer.icon} {nextPrayer.label}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      {formatTime(prayerTimes[nextPrayer.key])}
                    </span>
                  </div>
                </div>
              )}

              {/* Mizan / Yüksek Enlem Uyarısı */}
              {(isHighLatitude || mizanApplied) && (
                <Badge variant="outline" className="border-gold text-gold-foreground bg-gold/10 text-[10px] mt-2 px-1.5 py-0">
                  <Info className="w-2.5 h-2.5 mr-0.5" />
                  Mîzan kuralı
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Vakitler Listesi
// ────────────────────────────────────────────────────────────

function PrayerTimesList({
  prayerTimes,
  activePrayer,
  nextPrayer,
  settings,
  updateSettings,
}: {
  prayerTimes: PrayerTimes | null;
  activePrayer: PrayerInfo | null;
  nextPrayer: PrayerInfo | null;
  settings: any;
  updateSettings: (partial: any) => void;
}) {
  if (!prayerTimes) return null;

  const now = new Date();

  return (
    <Card className="w-full shadow-md overflow-hidden">
      {/* Başlık */}
      <div className="px-4 py-2.5 bg-islamic/5 border-b border-islamic/10">
        <h2 className="text-xs font-semibold text-islamic uppercase tracking-widest">
          Günün Vakitleri
        </h2>
      </div>

      {/* Vakit Satırları */}
      <div>
        {PRAYER_ORDER.map((prayer, index) => {
          const time = prayerTimes[prayer.key];
          const isActive = activePrayer?.key === prayer.key;
          const isNext = nextPrayer?.key === prayer.key;
          const isPast = time < now && !isActive;

          return (
            <div
              key={prayer.key}
              className={`
                vakit-row relative px-4 py-2.5 flex items-center justify-between
                ${isActive ? 'bg-islamic/8' : ''}
                ${isPast ? 'opacity-35' : ''}
                ${isNext ? 'bg-islamic/3' : ''}
                ${index < PRAYER_ORDER.length - 1 ? 'border-b border-border/20' : ''}
                hover:bg-accent/40 transition-all duration-200
              `}
            >
              {/* Sol: İlerleme çizgisi + İkon + İsim */}
              <div className="flex items-center gap-3">
                {/* Aktif/V Next Çizgisi */}
                <div className={`
                  w-1 h-7 rounded-full shrink-0 transition-colors
                  ${isActive ? 'bg-islamic' : isNext ? 'bg-gold' : isPast ? 'bg-muted-foreground/20' : 'bg-islamic/20'}
                `} />

                <div className="min-w-0">
                  <div className={`text-sm flex items-center gap-1.5 ${isActive ? 'font-bold text-islamic' : isNext ? 'font-medium text-foreground' : ''}`}>
                    <span className="text-base leading-none">{prayer.icon}</span>
                    <span>{prayer.label}</span>
                    {isActive && (
                      <Badge className="bg-islamic text-islamic-foreground text-[9px] px-1 py-0 h-4 ml-1">
                        AKTİF
                      </Badge>
                    )}
                    {isNext && !isActive && (
                      <Badge variant="outline" className="border-gold text-gold-foreground text-[9px] px-1 py-0 h-4 ml-1 bg-gold/5">
                        SONRAKİ
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Sağ: Saat + Alarm */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-base font-mono tabular-nums ${isActive ? 'text-islamic font-bold' : isNext ? 'font-semibold' : 'text-foreground/80'}`}>
                  {formatTime(time)}
                </span>
                {settings.alarms[prayer.key]?.alarm ? (
                  <Bell className="w-3 h-3 text-islamic/40" />
                ) : (
                  <BellOff className="w-3 h-3 text-muted-foreground/25" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ayarlar Butonu */}
      <div className="px-4 py-3 border-t border-border/30 bg-muted/20">
        <SettingsSheet settings={settings} updateSettings={updateSettings} />
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Ayarlar Sayfası
// ────────────────────────────────────────────────────────────

function SettingsSheet({
  settings,
  updateSettings,
}: {
  settings: any;
  updateSettings: (partial: any) => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full gap-2 border-islamic/30 hover:bg-islamic/10 hover:border-islamic/50 transition-colors">
          <Settings className="w-4 h-4" />
          Ayarlar ve Hatırlatıcılar
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-islamic" />
            Ayarlar
          </SheetTitle>
          <SheetDescription>Namaz vakti hesaplama ve hatırlatıcı ayarları</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* İkindi Hesaplama Yöntemi */}
          <SettingsSection title="İkindi Hesaplama Yöntemi">
            <Select
              value={settings.asrType}
              onValueChange={(val) => updateSettings({ asrType: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evvel">Asr-ı Evvel (Şâfiî/Mâlikî)</SelectItem>
                <SelectItem value="sani">Asr-ı Sânî (Hanefî)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Asr-ı Evvel: Gölge = nesne uzunluğu + anlık gölge &nbsp;|&nbsp; Asr-ı Sânî: Gölge = 2 × nesne uzunluğu + anlık gölge
            </p>
          </SettingsSection>

          <Separator />

          {/* Hatırlatıcılar */}
          <SettingsSection title="Vakit Hatırlatıcıları">
            <p className="text-xs text-muted-foreground mb-3">
              Her vakit için bildirim açıp kapatabilirsiniz. Seher ve İmsak için erken uyarı süresi seçebilirsiniz.
            </p>
            <div className="space-y-2">
              {PRAYER_ORDER.map((prayer) => (
                <AlarmSetting
                  key={prayer.key}
                  prayer={prayer}
                  alarm={settings.alarms[prayer.key]}
                  onChange={(alarm) => {
                    updateSettings({
                      alarms: {
                        ...settings.alarms,
                        [prayer.key]: alarm,
                      },
                    });
                  }}
                />
              ))}
            </div>
          </SettingsSection>

          <Separator />

          {/* Konum Ayarları */}
          <SettingsSection title="Konum Ayarları">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Otomatik konum tespiti</Label>
                <Switch
                  checked={settings.useAutoLocation}
                  onCheckedChange={(val) => updateSettings({ useAutoLocation: val })}
                />
              </div>

              {!settings.useAutoLocation && (
                <div className="space-y-3 pl-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Enlem (Latitude)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={settings.manualLatitude}
                      onChange={(e) => updateSettings({ manualLatitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Boylam (Longitude)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={settings.manualLongitude}
                      onChange={(e) => updateSettings({ manualLongitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Şehir Adı</Label>
                    <Input
                      value={settings.manualCity}
                      onChange={(e) => updateSettings({ manualCity: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          </SettingsSection>

          <Separator />

          {/* Hesaplama Metodolojisi */}
          <SettingsSection title="Hesaplama Metodolojisi">
            <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-3 rounded-lg leading-relaxed">
              <p className="font-semibold text-foreground text-sm mb-2">Süleymaniye Vakfı — Mîzan Sistemi</p>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <span className="text-foreground/70 font-medium">Seher</span>
                <span>Fecr-i Kâzıb, Güneş yüksekliği -18°</span>
                <span className="text-foreground/70 font-medium">İmsak</span>
                <span>Fecr-i Sâdık, Güneş yüksekliği -9°</span>
                <span className="text-foreground/70 font-medium">Güneş</span>
                <span>Doğuşu/Batışı, yükseklik -0.833°</span>
                <span className="text-foreground/70 font-medium">İkindi</span>
                <span>Cotangent gölge formülü (A(t))</span>
                <span className="text-foreground/70 font-medium">Yatsı</span>
                <span>Kırmızı şafak kaybı, -9°</span>
                <span className="text-foreground/70 font-medium">Yatsı Sonu</span>
                <span>Mîzan kuralı: Gece 1/4 + 1/2 + 1/4</span>
              </div>
              <Separator className="my-2" />
              <p className="font-medium text-foreground">Temkin (ihtiyat süresi) uygulanmaz</p>
              <p>Yüksek enlem: Sadece Mîzan kuralı, suni düzeltme yok</p>
            </div>
          </SettingsSection>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function AlarmSetting({
  prayer,
  alarm,
  onChange,
}: {
  prayer: PrayerInfo;
  alarm: any;
  onChange: (alarm: any) => void;
}) {
  const isPreAlarmAvailable = prayer.key === 'seher' || prayer.key === 'imsak';

  return (
    <div className={`flex items-center justify-between py-1.5 px-2 rounded-md ${alarm?.alarm ? 'bg-islamic/3' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm leading-none">{prayer.icon}</span>
        <span className="text-sm">{prayer.label}</span>
      </div>
      <div className="flex items-center gap-2">
        {/* Pre-alarm (sadece seher ve imsak) */}
        {isPreAlarmAvailable && alarm?.alarm && (
          <Select
            value={alarm.preAlarm?.enabled ? String(alarm.preAlarm.minutes) : '0'}
            onValueChange={(val) => {
              onChange({
                ...alarm,
                preAlarm: {
                  enabled: val !== '0',
                  minutes: parseInt(val) || 15,
                },
              });
            }}
          >
            <SelectTrigger className="h-7 w-[72px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Kapalı</SelectItem>
              <SelectItem value="15">15 dk</SelectItem>
              <SelectItem value="30">30 dk</SelectItem>
              <SelectItem value="45">45 dk</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Switch
          checked={alarm?.alarm ?? true}
          onCheckedChange={(val) => {
            onChange({
              ...alarm,
              alarm: val,
            });
          }}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Alt Bilgi
// ────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="w-full py-3 px-4 text-center">
      <div className="flex items-center justify-center gap-2 mb-1">
        <div className="h-px w-8 bg-islamic/20" />
        <span className="text-xs text-islamic/60 font-medium">MÎZAN</span>
        <div className="h-px w-8 bg-islamic/20" />
      </div>
      <p className="text-[10px] text-muted-foreground/50">
        Süleymaniye Vakfı Mîzan Metodolojisi &middot; Astronomik hesaplama &middot; Temkin uygulanmaz
      </p>
    </footer>
  );
}
