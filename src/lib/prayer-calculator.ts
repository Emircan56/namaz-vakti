/**
 * Namaz Vakti Hesaplama Motoru
 * =================================================
 * Süleymaniye Vakfı: Fıkhî-astronomik Mîzan metodolojisi (özel hesaplama)
 * Diğer yöntemler: Adhan kütüphanesi kullanılarak hesaplanır
 *
 * Temel kaynak: Süleymaniye Vakfı Mîzan sistemi / Adhan kütüphanesi
 */

import {
  CalculationMethod as AdhanCalculationMethod,
  CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PolarCircleResolution,
  PrayerTimes as AdhanPrayerTimes,
  Rounding,
} from 'adhan';

// ────────────────────────────────────────────────────────────
// Tip Tanımlamaları
// ────────────────────────────────────────────────────────────

export type AsrType = 'evvel' | 'sani';

export type CalculationMethod =
  | 'suleymaniye'  // Süleymaniye Vakfı (Mîzan) — özel hesaplama
  | 'diyanet'      // Diyanet (Türkiye) — Adhan: Turkey
  | 'mwl'          // Müslüman Dünyası Ligi — Adhan: MuslimWorldLeague
  | 'isna'         // ISNA (Kuzey Amerika) — Adhan: NorthAmerica
  | 'egyptian'     // Mısır Genel Meclisi — Adhan: Egyptian
  | 'karachi'      // University of Islamic Sciences, Karachi — Adhan: Karachi
  | 'ummalqura'    // Ümmü'l-Kurâ (Mekke) — Adhan: UmmAlQura
  | 'dubai'        // Dubai (BAE) — Adhan: Dubai
  | 'qatar'        // Katar — Adhan: Qatar
  | 'kuwait'       // Kuveyt — Adhan: Kuwait
  | 'singapore'    // Singapur — Adhan: Singapore
  | 'tehran';      // Tahran — Adhan: Tehran

export interface PrayerTimes {
  seher: Date;       // Fecr-i Kâzib (-18°) — sadece Süleymaniye
  imsak: Date;       // Fecr-i Sâdık / Fajr
  gunes: Date;       // Güneş Doğuşu / Sunrise
  ogle: Date;        // Zeval (Meridyen geçişi) / Dhuhr
  ikindi: Date;      // Asr (gölge formülü)
  aksam: Date;       // Güneş Batışı / Maghrib
  yatsi: Date;       // İşâ / Isha
  yatsiSonu: Date;   // Akşam tarafı -18° — sadece Süleymaniye
}

export interface PrayerTimeResult {
  times: PrayerTimes;
  isHighLatitude: boolean;
  mizanApplied: boolean;
  declination: number;
  eqt: number;
  method: CalculationMethod;
}

export interface Location {
  latitude: number;   // Enlem (derece)
  longitude: number;  // Boylam (derece)
  timezone: number;   // Saat dilimi offset (saat)
  city?: string;
  country?: string;
}

export interface CalculatorConfig {
  asrType: AsrType;
  method: CalculationMethod;
  seherAngle: number;    // Varsayılan: -18
  imsakAngle: number;    // Varsayılan: -9 (SV), -18 (Diyanet/MWL), -15 (ISNA), -19.5 (Egypt)
  yatsiAngle: number;    // Varsayılan: -9 (SV), -17 (Diyanet/MWL), -15 (ISNA), -17.5 (Egypt)
  gunesRefraction: number; // Varsayılan: 0.833
  temkin: number;        // Dakika cinsinden temkin (0 = SV, 2 = Diyanet)
}

export interface MethodConfig {
  label: string;
  /** Adhan kütüphanesi yöntem adı (sadece non-SV için) */
  adhanMethod?: string;
  /** SV hesaplama parametreleri (sadece SV için) */
  imsakAngle?: number;
  yatsiAngle?: number;
  temkin?: number;
  asrType?: AsrType;
  /** Hanafi mezhebi mi? (ikindi için) */
  hanafi?: boolean;
}

export const METHOD_CONFIGS: Record<CalculationMethod, MethodConfig> = {
  suleymaniye:  { label: 'Süleymaniye Vakfı (Mîzan)', imsakAngle: -9, yatsiAngle: -9, temkin: 0, asrType: 'evvel', hanafi: false },
  diyanet:      { label: 'Diyanet (Türkiye)', adhanMethod: 'Turkey', hanafi: false },
  mwl:          { label: 'Müslüman Dünyası Ligi', adhanMethod: 'MuslimWorldLeague', hanafi: false },
  isna:         { label: 'ISNA (Kuzey Amerika)', adhanMethod: 'NorthAmerica', hanafi: false },
  egyptian:     { label: 'Mısır Genel Meclisi', adhanMethod: 'Egyptian', hanafi: false },
  karachi:      { label: 'Karachi', adhanMethod: 'Karachi', hanafi: false },
  ummalqura:    { label: 'Ümmü\'l-Kurâ (Mekke)', adhanMethod: 'UmmAlQura', hanafi: false },
  dubai:        { label: 'Dubai (BAE)', adhanMethod: 'Dubai', hanafi: true },
  qatar:        { label: 'Katar', adhanMethod: 'Qatar', hanafi: false },
  kuwait:       { label: 'Kuveyt', adhanMethod: 'Kuwait', hanafi: false },
  singapore:    { label: 'Singapur', adhanMethod: 'Singapore', hanafi: false },
  tehran:       { label: 'Tahran', adhanMethod: 'Tehran', hanafi: false },
};

export const DEFAULT_CONFIG: CalculatorConfig = {
  asrType: 'evvel',
  method: 'suleymaniye',
  seherAngle: -18,
  imsakAngle: -9,
  yatsiAngle: -9,
  gunesRefraction: 0.833,
  temkin: 0,
};

/**
 * Adhan kütüphanesinden hesaplama parametrelerini alır
 */
function getAdhanParams(method: CalculationMethod): CalculationParameters {
  const config = METHOD_CONFIGS[method];
  const adhanMethod = config.adhanMethod;

  if (!adhanMethod) {
    // SV için MWL kullanılır ama sonuç göz ardı edilir
    return AdhanCalculationMethod.MuslimWorldLeague();
  }

  switch (adhanMethod) {
    case 'MuslimWorldLeague': return AdhanCalculationMethod.MuslimWorldLeague();
    case 'Egyptian': return AdhanCalculationMethod.Egyptian();
    case 'Karachi': return AdhanCalculationMethod.Karachi();
    case 'UmmAlQura': return AdhanCalculationMethod.UmmAlQura();
    case 'Dubai': return AdhanCalculationMethod.Dubai();
    case 'MoonsightingCommittee': return AdhanCalculationMethod.MoonsightingCommittee();
    case 'NorthAmerica': return AdhanCalculationMethod.NorthAmerica();
    case 'Kuwait': return AdhanCalculationMethod.Kuwait();
    case 'Qatar': return AdhanCalculationMethod.Qatar();
    case 'Singapore': return AdhanCalculationMethod.Singapore();
    case 'Tehran': return AdhanCalculationMethod.Tehran();
    case 'Turkey': return AdhanCalculationMethod.Turkey();
    default: return AdhanCalculationMethod.MuslimWorldLeague();
  }
}

/**
 * Adhan kütüphanesi ile namaz vakitlerini hesaplar
 * @param asrMadhab - İkindi mezhebi seçimi: 'standard' (Shafi'i) veya 'hanafi'
 */
function calculateWithAdhan(date: Date, location: Location, method: CalculationMethod, asrMadhab?: 'standard' | 'hanafi'): PrayerTimeResult {
  const coords = new Coordinates(location.latitude, location.longitude);
  const params = getAdhanParams(method);

  // İkindi mezhebi ayarı: kullanıcı seçimi öncelikli, sonra yöntem varsayılanı
  const useHanafi = asrMadhab === 'hanafi' || (asrMadhab === undefined && METHOD_CONFIGS[method].hanafi);
  if (useHanafi) {
    params.madhab = Madhab.Hanafi;
  }

  // Yüksek enlem kuralı
  params.highLatitudeRule = HighLatitudeRule.recommended(coords);

  // Kutup dairesi çözümleme
  params.polarCircleResolution = PolarCircleResolution.AqrabYaum;

  // Yuvarlama: yukarı (temkin amaçlı)
  params.rounding = Rounding.Up;

  // Kullanıcının yerel tarihini hesapla (sunucu saat diliminden bağımsız)
  const utcMs = date.getTime();
  const userLocalMs = utcMs + location.timezone * 3600000;
  const userLocalDate = new Date(userLocalMs);
  const year = userLocalDate.getUTCFullYear();
  const month = userLocalDate.getUTCMonth();
  const day = userLocalDate.getUTCDate();

  // Adhan kütüphanesine kullanıcının yerel tarihini ver
  // Adhan, Date'in yerel metodlarını kullanarak tarihi belirler
  // Bu yüzden UTC saatini kullanıcının yerel tarihine ayarlıyoruz
  const adhanDate = new Date(Date.UTC(year, month, day, 12, 0, 0));

  // Adhan hesaplama
  const adhanTimes = new AdhanPrayerTimes(coords, adhanDate, params);

  // Adhan UTC tarihlerini hedef saat dilimine çevir
  // Adhan kütüphanesi UTC Date nesneleri döndürür.
  // location.timezone offset (saat cinsinden) kullanarak yerel saate çeviririz.
  const tzOffset = location.timezone; // saat cinsinden (örn: 3 for UTC+3)

  // UTC saati + timezone offset = yerel saat, sonra Date.UTC ile doğru timestamp oluştur
  const toLocalTime = (utcDate: Date): Date => {
    const utcHours = utcDate.getUTCHours();
    const utcMinutes = utcDate.getUTCMinutes();
    // UTC dakikalarını hesapla + timezone offset (dakika cinsinden)
    const totalLocalMinutes = (utcHours * 60 + utcMinutes) + (tzOffset * 60);
    const localHours = Math.floor(totalLocalMinutes / 60) % 24;
    const localMinutes = totalLocalMinutes % 60;
    const adjustedHours = localHours < 0 ? localHours + 24 : localHours;
    // Doğru UTC timestamp: yerel saat - timezone = UTC
    return new Date(Date.UTC(year, month, day, adjustedHours - tzOffset, localMinutes, 0));
  };

  const times: PrayerTimes = {
    seher: new Date(Date.UTC(year, month, day, 0 - tzOffset, 0, 0)),       // Kullanılmayacak
    imsak: toLocalTime(adhanTimes.fajr),
    gunes: toLocalTime(adhanTimes.sunrise),
    ogle: toLocalTime(adhanTimes.dhuhr),
    ikindi: toLocalTime(adhanTimes.asr),
    aksam: toLocalTime(adhanTimes.maghrib),
    yatsi: toLocalTime(adhanTimes.isha),
    yatsiSonu: new Date(Date.UTC(year, month, day, 0 - tzOffset, 0, 0)),   // Kullanılmayacak
  };

  return {
    times,
    isHighLatitude: false, // Adhan kendi yüksek enlem kurallarını uygular
    mizanApplied: false,
    declination: 0,
    eqt: 0,
    method,
  };
}

// ────────────────────────────────────────────────────────────
// Yardımcı Fonksiyonlar
// ────────────────────────────────────────────────────────────

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function sin(d: number): number {
  return Math.sin(d * DEG2RAD);
}

function cos(d: number): number {
  return Math.cos(d * DEG2RAD);
}

function tan(d: number): number {
  return Math.tan(d * DEG2RAD);
}

function arcsin(x: number): number {
  return Math.asin(x) * RAD2DEG;
}

function arccos(x: number): number {
  return Math.acos(Math.max(-1, Math.min(1, x))) * RAD2DEG;
}

function arctan2(y: number, x: number): number {
  return Math.atan2(y, x) * RAD2DEG;
}

function arctan(x: number): number {
  return Math.atan(x) * RAD2DEG;
}

function fixAngle(a: number): number {
  a = a % 360;
  return a < 0 ? a + 360 : a;
}

function fixHour(h: number): number {
  h = h % 24;
  return h < 0 ? h + 24 : h;
}

// ────────────────────────────────────────────────────────────
// Astronomik Hesaplamalar (USNO Algoritması)
// ────────────────────────────────────────────────────────────

/**
 * Jülyen Gün Sayısı (Julian Day Number) hesaplama
 */
function julianDay(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) +
         Math.floor(30.6001 * (month + 1)) +
         day + B - 1524.5;
}

/**
 * J2000.0'dan itibaren geçen yüzyıl sayısı
 */
function julianCentury(jd: number): number {
  return (jd - 2451545.0) / 36525.0;
}

/**
 * Güneş'in ortalama boylamı (derece)
 */
function sunMeanLongitude(T: number): number {
  return fixAngle(280.46645 + 36000.76983 * T + 0.0003032 * T * T);
}

/**
 * Güneş'in ortalama anomalisi (derece)
 */
function sunMeanAnomaly(T: number): number {
  return fixAngle(357.5291 + 35999.0503 * T - 0.0001559 * T * T - 0.00000048 * T * T * T);
}

/**
 * Dünya'nın yörünge eksantrikliği
 */
function earthEccentricity(T: number): number {
  return 0.016708617 - 0.000042037 * T - 0.0000001236 * T * T;
}

/**
 * Güneş'in denklem merkezi (Equation of Center)
 */
function sunEquationOfCenter(T: number, M: number): number {
  const Mrad = M * DEG2RAD;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad) +
            (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
            0.000289 * Math.sin(3 * Mrad);
  return C;
}

/**
 * Güneş'in gerçek boylamı (True Longitude)
 */
function sunTrueLongitude(T: number): number {
  const L0 = sunMeanLongitude(T);
  const M = sunMeanAnomaly(T);
  const C = sunEquationOfCenter(T, M);
  return fixAngle(L0 + C);
}

/**
 * Güneş'in görünen boylamı (Apparent Longitude)
 */
function sunApparentLongitude(T: number): number {
  const O = sunTrueLongitude(T);
  const omega = 125.04 - 1934.136 * T;
  return O - 0.00569 - 0.00478 * Math.sin(omega * DEG2RAD);
}

/**
 * Ekliptik oblik (Ecliptic Obliquity / Eğiklik)
 * ε = 23.439° - 0.00000036° × d
 */
function meanObliquity(T: number): number {
  const seconds = 21.448 - T * (46.815 + T * (0.00059 - T * 0.001813));
  return 23.0 + (26.0 + seconds / 60.0) / 60.0;
}

function obliquityCorrection(T: number): number {
  const e0 = meanObliquity(T);
  const omega = 125.04 - 1934.136 * T;
  return e0 + 0.00256 * Math.cos(omega * DEG2RAD);
}

/**
 * Güneş'in saat açısı için dik açıklık (Right Ascension)
 */
function sunRightAscension(T: number): number {
  const e = obliquityCorrection(T);
  const lambda = sunApparentLongitude(T);
  const tananum = cos(e) * Math.sin(lambda * DEG2RAD);
  const tanadenom = Math.cos(lambda * DEG2RAD);
  return arctan2(tananum, tanadenom);
}

/**
 * Güneş'in dik açıklığı (Solar Declination / δ)
 * δ = arcsin(sin(ε) × sin(λ))
 */
function solarDeclination(T: number): number {
  const e = obliquityCorrection(T);
  const lambda = sunApparentLongitude(T);
  return arcsin(sin(e) * Math.sin(lambda * DEG2RAD));
}

/**
 * Zaman Denklemi (Equation of Time)
 * EqT = q/15 - RA (saat cinsinden)
 * 
 * q: Güneş'in ortalama boylamının J2000'den farkı (derece → saat)
 * RA: Saat açısı dik açıklık (derece → saat)
 */
function equationOfTime(T: number): number {
  const epsilon = obliquityCorrection(T);
  const L0 = sunMeanLongitude(T);
  const e = earthEccentricity(T);
  const M = sunMeanAnomaly(T);

  const y = Math.tan(epsilon * DEG2RAD / 2);
  const y2 = y * y;

  const sin2L0 = Math.sin(2 * L0 * DEG2RAD);
  const sinM = Math.sin(M * DEG2RAD);
  const cos2L0 = Math.cos(2 * L0 * DEG2RAD);
  const sin2M = Math.sin(2 * M * DEG2RAD);
  const cosM = Math.cos(M * DEG2RAD);

  const Etime = y2 * sin2L0 -
                2 * e * sinM +
                4 * e * y * sinM * cos2L0 -
                0.5 * y2 * sin2M -
                1.25 * e * e * sin2M;

  // Derece cinsinden → saat cinsine çevir (1/15)
  return Etime * 4.0 / 60.0; // Dakika cinsinden
}

/**
 * Daha basit ve doğru EqT hesaplama (USNO tabanlı)
 */
function equationOfTimeAlt(T: number): number {
  const L0 = sunMeanLongitude(T);
  const M = sunMeanAnomaly(T);
  const e = earthEccentricity(T);
  const epsilon = obliquityCorrection(T);

  // Güneşin gerçek boylamı
  const C = sunEquationOfCenter(T, M);
  const sunTrueLong = L0 + C;

  // Saat açısı (Right Ascension)
  const RA = arctan2(cos(epsilon) * Math.sin(sunTrueLong * DEG2RAD), Math.cos(sunTrueLong * DEG2RAD));

  // EqT = (L0 - RA) olarak hesapla, saat cinsine çevir
  let eqt = (L0 - RA) / 15.0;

  // 0-24 aralığına getir
  if (eqt > 12) eqt -= 24;
  if (eqt < -12) eqt += 24;

  return eqt; // Saat cinsinden
}

// ────────────────────────────────────────────────────────────
// Temel Vakit Hesaplama Fonksiyonları
// ────────────────────────────────────────────────────────────

/**
 * Saat Açısı (Hour Angle) fonksiyonu
 * T(α) = (1/15) × arccos[(sin(α) - sin(φ) × sin(δ)) / (cos(φ) × cos(δ))]
 * 
 * Standart astronomik konvansiyon: α güneş yükseklik açısıdır.
 * α > 0: ufuk üstü, α < 0: ufuk altı (depression angle)
 * 
 * @param alpha - Güneş yükseklik açısı (derece, negatif = ufuk altı)
 * @param latitude - Enlem (derece)
 * @param declination - Güneş dik açıklığı (derece)
 * @returns Saat açısı (saat cinsinden)
 */
function hourAngle(alpha: number, latitude: number, declination: number): number {
  const cosH = (sin(alpha) - sin(latitude) * sin(declination)) /
               (cos(latitude) * cos(declination));

  // Beyaz geceler: Güneş bu açıya inmiyor
  if (cosH > 1) return NaN;  // Güneş hiç batmıyor
  if (cosH < -1) return NaN; // Güneş hiç doğmuyor

  return (1 / 15) * arccos(cosH);
}

/**
 * Asr Gölge Formülü
 * A(t) = (1/15) × arccos[(sin(arctan(1/(t + tan(|φ - δ|)))) - sin(φ) × sin(δ)) / (cos(φ) × cos(δ))]
 * 
 * @param shadowFactor - Gölge çarpanı (1 = Asr-ı Evvel, 2 = Asr-ı Sani)
 * @param latitude - Enlem (derece)
 * @param declination - Güneş dik açıklığı (derece)
 * @returns İkindi için saat açısı (saat cinsinden)
 */
function asrHourAngle(shadowFactor: number, latitude: number, declination: number): number {
  const phi = latitude;
  const delta = declination;

  // Gölge açısı: arctan(1 / (t + tan(|φ - δ|)))
  const angle = arctan(1 / (shadowFactor + Math.abs(tan(phi - delta))));

  const cosH = (sin(angle) - sin(phi) * sin(delta)) /
               (cos(phi) * cos(delta));

  if (cosH > 1 || cosH < -1) return NaN;

  return (1 / 15) * arccos(cosH);
}

/**
 * Öğle vakti (Zeval / Dhuhr) hesaplama
 * Dhuhr = 12 + TimeZone - L/15 - EqT
 */
function dhuhrTime(longitude: number, timezone: number, eqt: number): number {
  return 12 + timezone - longitude / 15 - eqt;
}

// ────────────────────────────────────────────────────────────
// MİZAN KURALI (Yüksek Enlem Algoritması)
// ────────────────────────────────────────────────────────────

/**
 * Mizan Kuralı: Geceyi üçe bölen fıkhî yöntem
 * 
 * T_gece = T_güneş_doğuşu - T_aksam_vakti
 * 
 * P1 = Akşamdan Yatsı sonuna kadar (1/3 gece veya hesaplanan)
 * P2 = Uyku/Teheccüd (en uzun bölüm, > P1)
 * P3 = İmsaktan Güneşe kadar (P1'e eşit)
 * 
 * Koşul: P1 = P3 ve P2 > P1
 */
function applyMizanRule(
  aksamHour: number,
  gunesHour: number,
  imsakHour: number,
  yatsiHour: number
): { yatsiHour: number; yatsiSonuHour: number; imsakHour: number } {
  // Gece süresi (saat cinsinden)
  // Güneş batışından ertesi gün doğuşuna kadar
  let nightDuration: number;
  
  if (gunesHour < aksamHour) {
    // Güneş doğuşu ertesi günde
    nightDuration = (24 - aksamHour) + gunesHour;
  } else {
    nightDuration = gunesHour - aksamHour;
  }

  // Mizan kuralı: Geceyi üçe böl
  // P1 = Akşam → Yatsı sonu = gece/3
  // P2 = Yatsı sonu → İmsak = gece/3 (en uzun uyku bölümü)
  // P3 = İmsak → Güneş doğuşu = gece/3
  // 
  // Daha doğru Mizan yaklaşımı:
  // P1 (Akşam→Yatsı) = 1/7 gece
  // P2 (Yatsı sonu→İmsak) = 4/7 gece (uyku/teheccüd, en uzun)
  // P3 (İmsak→Güneş) = 2/7 gece
  // 
  // Süleymaniye Vakfı Mîzan: P1 = P3 ve P2 > P1
  // En basit yorum: gece/3 + gece/3 + gece/3 = gece, P2 = gece/3
  // AMA P2 > P1 olmalı → P2 = gece/2, P1 = P3 = gece/4
  // Bu durumda: gece/4 + gece/2 + gece/4 = gece ✓, P2 > P1 ✓
  
  const p1 = nightDuration / 4; // Akşam → Yatsı sonu
  const p2 = nightDuration / 2; // Yatsı sonu → İmsak (uyku/teheccüd)
  const p3 = nightDuration / 4; // İmsak → Güneş doğuşu

  const newYatsiSonu = fixHour(aksamHour + p1);
  const newImsak = fixHour(gunesHour - p3);
  const newYatsi = fixHour(aksamHour + nightDuration / 6); // Yatsı: Akşam + gece/6

  return {
    yatsiHour: isFinite(newYatsi) ? newYatsi : aksamHour + 1.5,
    yatsiSonuHour: isFinite(newYatsiSonu) ? newYatsiSonu : aksamHour + nightDuration / 4,
    imsakHour: isFinite(newImsak) ? newImsak : gunesHour - nightDuration / 4,
  };
}

// ────────────────────────────────────────────────────────────
// ANA HESAPLAMA SINIFI
// ────────────────────────────────────────────────────────────

export class SuleymaniyePrayerCalculator {
  private config: CalculatorConfig;
  private _asrMadhab: 'standard' | 'hanafi';

  constructor(config: Partial<CalculatorConfig> = {}, asrMadhab: 'standard' | 'hanafi' = 'standard') {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._asrMadhab = asrMadhab;
  }

  /**
   * Belirli bir tarih ve konum için namaz vakitlerini hesaplar
   * Süleymaniye Vakfı: Özel Mîzan hesaplaması
   * Diğer yöntemler: Adhan kütüphanesi
   */
  calculate(date: Date, location: Location): PrayerTimeResult {
    const method = this.config.method;

    // Süleymaniye Vakfı dışındaki yöntemler Adhan kütüphanesi ile hesaplanır
    if (method !== 'suleymaniye') {
      return calculateWithAdhan(date, location, method, this._asrMadhab);
    }

    // ── Süleymaniye Vakfı Mîzan Hesaplaması ──
    // Kullanıcının yerel tarihini hesapla (sunucu saat diliminden bağımsız)
    const utcMs = date.getTime();
    const userLocalMs = utcMs + location.timezone * 3600000;
    const userLocalDate = new Date(userLocalMs);

    // Julian Day: kullanıcının yerel tarihi + öğle vakti (0.5 gün)
    // Bu, gece yarisi geçiş durumlarında (UTC'de farklı tarih) doğru günü verir
    const jd = julianDay(
      userLocalDate.getUTCFullYear(),
      userLocalDate.getUTCMonth() + 1,
      userLocalDate.getUTCDate() + 0.5  // Yerel öğle vakti
    );

    const T = julianCentury(jd);

    // Astronomik parametreler
    const delta = solarDeclination(T);   // Güneş dik açıklığı (δ)
    const eqt = equationOfTimeAlt(T);     // Zaman denklemi (saat)

    const phi = location.latitude;
    const L = location.longitude;
    const tz = location.timezone;

    // ── Öğle (Zeval / Dhuhr) ──
    const dhuhr = dhuhrTime(L, tz, eqt);

    // ── Saat Açısı Hesaplamaları ──

    // Seher Vakti (Fecr-i Kâzib): -18°
    const T_seher = hourAngle(this.config.seherAngle, phi, delta);

    // İmsak (Fecr-i Sâdık / Fajr): yönteme göre farklı açılar
    const T_imsak = hourAngle(this.config.imsakAngle, phi, delta);

    // Güneş Doğuşu: -0.833°
    const T_gunes = hourAngle(-this.config.gunesRefraction, phi, delta);

    // Akşam (Güneş Batışı): -0.833°
    const T_aksam = T_gunes; // Simetrik

    // Yatsı: yönteme göre farklı açılar
    const T_yatsi = hourAngle(this.config.yatsiAngle, phi, delta);

    // İkindi (Asr Gölge Formülü)
    const shadowFactor = this.config.asrType === 'evvel' ? 1 : 2;
    const A_asr = asrHourAngle(shadowFactor, phi, delta);

    // ── Vakit Hesaplamaları ──

    let seherHour = fixHour(dhuhr - T_seher);
    let imsakHour = fixHour(dhuhr - T_imsak);
    let gunesHour = fixHour(dhuhr - T_gunes);
    let ogleHour = fixHour(dhuhr);
    let ikindiHour = fixHour(dhuhr + A_asr);
    let aksamHour = fixHour(dhuhr + T_aksam);
    let yatsiHour = fixHour(dhuhr + T_yatsi);

    // ── Yatsı Sonu (sadece Süleymaniye) ──
    const T_yatsiSonu = hourAngle(this.config.seherAngle, phi, delta);

    let yatsiSonuHour: number;
    let isHighLatitude = false;
    let mizanApplied = false;

    // Yüksek enlem kontrolü (sadece SV için bu kod yolu)
    if (isNaN(T_imsak) || isNaN(T_yatsi) || isNaN(T_seher)) {
      isHighLatitude = true;
      mizanApplied = true;
      const mizan = applyMizanRule(aksamHour, gunesHour, imsakHour, yatsiHour);

      yatsiHour = mizan.yatsiHour;
      yatsiSonuHour = mizan.yatsiSonuHour;
      imsakHour = mizan.imsakHour;
      seherHour = fixHour(imsakHour - 1);

      if (isNaN(T_imsak)) imsakHour = mizan.imsakHour;
      if (isNaN(T_seher)) seherHour = fixHour(imsakHour - 1);
    } else if (isNaN(T_yatsiSonu)) {
      let nightDuration: number;
      if (gunesHour < aksamHour) {
        nightDuration = (24 - aksamHour) + gunesHour;
      } else {
        nightDuration = gunesHour - aksamHour;
      }
      const aksamToYatsi = yatsiHour - aksamHour;
      const imsakToSeher = imsakHour - seherHour;
      yatsiSonuHour = fixHour(aksamHour + aksamToYatsi + imsakToSeher * 0.7);
    } else {
      yatsiSonuHour = fixHour(dhuhr + T_yatsiSonu);
    }

    // ── Date Nesnelerine Dönüştür ──
    const times = this.hoursToDate(date, {
      seher: seherHour,
      imsak: imsakHour,
      gunes: gunesHour,
      ogle: ogleHour,
      ikindi: ikindiHour,
      aksam: aksamHour,
      yatsi: yatsiHour,
      yatsiSonu: yatsiSonuHour,
    }, location.timezone);

    return {
      times,
      isHighLatitude,
      mizanApplied,
      declination: delta,
      eqt: eqt * 60,
      method,
    };
  }

  /**
   * Saat cinsinden değerleri Date nesnelerine dönüştürür
   *
   * Timezone-aware: Kullanıcının saat dilimi offset'ini kullanarak
   * doğru UTC timestamp'li Date nesneleri oluşturur.
   * Bu, sunucu ve istemci saat dilimi farkından kaynaklanan kaymaları önler.
   *
   * Örnek: Öğle 12:07 UTC+3 → Date.UTC(year, month, day, 12-3, 7, 0) = 09:07 UTC
   */
  private hoursToDate(baseDate: Date, hours: Record<string, number>, timezone: number): PrayerTimes {
    const result: Partial<PrayerTimes> = {};

    // Kullanıcının yerel tarihini UTC + timezone offset ile hesapla
    // Bu, sunucu saat diliminden bağımsız olarak doğru tarihi verir
    const utcMs = baseDate.getTime();
    const userLocalMs = utcMs + timezone * 3600000;
    const userLocalDate = new Date(userLocalMs);
    const year = userLocalDate.getUTCFullYear();
    const month = userLocalDate.getUTCMonth();
    const day = userLocalDate.getUTCDate();

    for (const [key, hour] of Object.entries(hours)) {
      // "Son" vakitleri (güneş doğuşu, yatsı sonu) geriye yuvarla:
      // Bu vakitler bir vaktin bitişi olduğundan, erken bitirme temkini uygulanır.
      // Diğer tüm vakitler ileriye yuvarlanır (geç başlama temkini).
      const isEndTime = key === 'gunes' || key === 'yatsiSonu';
      const totalMinutes = hour * 60;
      const roundedMinutes = isEndTime ? Math.floor(totalMinutes) : Math.ceil(totalMinutes);
      const h = Math.floor(roundedMinutes / 60);
      const m = roundedMinutes % 60;
      // Yerel saat h:m, timezone offset ile UTC'ye çevir
      // Öğle 12:07 UTC+3 → Date.UTC(year, month, day, 12-3, 7, 0) = 09:07 UTC
      result[key as keyof PrayerTimes] = new Date(Date.UTC(year, month, day, h - timezone, m, 0));
    }

    return result as PrayerTimes;
  }

  /**
   * Ayarları günceller
   */
  updateConfig(config: Partial<CalculatorConfig>, asrMadhab?: 'standard' | 'hanafi'): void {
    this.config = { ...this.config, ...config };
    if (asrMadhab !== undefined) {
      this._asrMadhab = asrMadhab;
    }
  }

  getConfig(): CalculatorConfig {
    return { ...this.config };
  }
}

// ────────────────────────────────────────────────────────────
// HİCRİ TARİH DÖNÜŞÜMÜ (Yaklaşık)
// ────────────────────────────────────────────────────────────

export interface HijriDate {
  year: number;
  month: number;
  day: number;
  monthName: string;
}

const HIJRI_MONTHS = [
  'Muharrem', 'Safer', 'Rebiülevvel', 'Rebiülâhir',
  'Rumusâni', 'Cemaziyelevvel', 'Cemaziyelâhir', 'Recep',
  'Şaban', 'Ramazan', 'Şevval', 'Zilkade', 'Zilhicce'
];

/**
 * Miladi → Hicri tarih dönüşümü (Kuwaiti algoritması, yaklaşık)
 */
export function gregorianToHijri(date: Date): HijriDate {
  const gd = date.getDate();
  const gm = date.getMonth() + 1;
  const gy = date.getFullYear();

  if (gy < 1583) {
    throw new Error('Bu algoritma 1583 sonrası için geçerlidir');
  }

  let d = gd;
  let m = gm;
  let y = gy;

  if (m < 3) {
    y -= 1;
    m += 12;
  }

  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);

  const jd = Math.floor(365.25 * (y + 4716)) +
             Math.floor(30.6001 * (m + 1)) +
             d + b - 1524.5;

  // Hicri hesaplama
  const l = Math.floor(jd - 1948439.5 + 10632);
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
            Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
             Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const mH = Math.floor((24 * l3) / 709);
  const dH = l3 - Math.floor((709 * mH) / 24);
  const yH = 30 * n + j - 30;

  return {
    year: yH,
    month: mH,
    day: dH,
    monthName: HIJRI_MONTHS[mH - 1] || '',
  };
}

// ────────────────────────────────────────────────────────────
// VAKİT BİLGİ YARDIMCILARI
// ────────────────────────────────────────────────────────────

export interface PrayerInfo {
  key: keyof PrayerTimes;
  label: string;
  icon: string;
}

// Süleymaniye Vakfı: 8 vakit
export const PRAYER_ORDER_SV: PrayerInfo[] = [
  { key: 'seher', label: 'Seher Vakti', icon: '🌙' },
  { key: 'imsak', label: 'Sabah Namazı', icon: '🌅' },
  { key: 'gunes', label: 'Sabah Namazı Sonu', icon: '☀️' },
  { key: 'ogle', label: 'Öğle', icon: '🌤️' },
  { key: 'ikindi', label: 'İkindi', icon: '⛅' },
  { key: 'aksam', label: 'Akşam', icon: '🌆' },
  { key: 'yatsi', label: 'Yatsı', icon: '🌉' },
  { key: 'yatsiSonu', label: 'Yatsı Sonu', icon: '🕤' },
];

// Diğer yöntemler: 6 vakit
export const PRAYER_ORDER_STANDARD: PrayerInfo[] = [
  { key: 'imsak', label: 'İmsak', icon: '🌅' },
  { key: 'gunes', label: 'Güneş', icon: '☀️' },
  { key: 'ogle', label: 'Öğle', icon: '🌤️' },
  { key: 'ikindi', label: 'İkindi', icon: '⛅' },
  { key: 'aksam', label: 'Akşam', icon: '🌆' },
  { key: 'yatsi', label: 'Yatsı', icon: '🌉' },
];

/** Geriye uyumluluk için */
export const PRAYER_ORDER = PRAYER_ORDER_SV;

export function getPrayerOrder(method: CalculationMethod): PrayerInfo[] {
  return method === 'suleymaniye' ? PRAYER_ORDER_SV : PRAYER_ORDER_STANDARD;
}

/**
 * Şu anki aktif vakti ve sıradaki vakti bulur
 */
export function getActivePrayer(
  times: PrayerTimes,
  now: Date,
  method: CalculationMethod = 'suleymaniye'
): { active: PrayerInfo; next: PrayerInfo; timeUntilNext: number } | null {
  const order = getPrayerOrder(method);
  const keys = order.map(p => p.key);

  for (let i = keys.length - 1; i >= 0; i--) {
    const currentTime = times[keys[i]];
    if (now >= currentTime) {
      const active = order[i];
      const nextIndex = (i + 1) % order.length;
      const next = order[nextIndex];
      // Gece yarısını geçen vakit (ertesi gün) için hesaplama
      let nextTime = times[keys[nextIndex]];
      if (nextIndex === 0) {
        // İlk vaktin ertesi gün olduğunu varsay
        nextTime = new Date(nextTime.getTime() + 24 * 60 * 60 * 1000);
      }
      const timeUntilNext = nextTime.getTime() - now.getTime();
      return { active, next, timeUntilNext };
    }
  }

  // Şu an ilk vakitten önce
  const active = order[order.length - 1];
  const next = order[0];
  return {
    active,
    next,
    timeUntilNext: times[keys[0]].getTime() - now.getTime(),
  };
}

/**
 * Saat değerine en yakın saat emoji'sini döndürür.
 * Yarı saat emojileri de kullanılır: 22:32 → 🕤 (22:30), 05:10 → 🕔 (05:00)
 * Yuvarlama: 0-14dk → tam saat, 15-44dk → yarı saat, 45-59dk → üst tam saat
 */
export function getClockEmoji(date: Date): string {
  // 24 emoji: sırayla 12:00, 12:30, 1:00, 1:30, 2:00, 2:30, ... 11:00, 11:30
  const clockEmojis = [
    '🕛', '🕧', '🕐', '🕜', '🕑', '🕝',
    '🕒', '🕞', '🕓', '🕟', '🕔', '🕠',
    '🕕', '🕡', '🕖', '🕢', '🕗', '🕣',
    '🕘', '🕤', '🕙', '🕥', '🕚', '🕦',
  ];
  const h = date.getHours() % 12; // 0-11 (0 = 12)
  const m = date.getMinutes();
  let index: number;
  if (m < 15) {
    // tam saat
    index = h * 2;
  } else if (m < 45) {
    // yarı saat
    index = h * 2 + 1;
  } else {
    // üst tam saat
    index = ((h + 1) % 12) * 2;
  }
  return clockEmojis[index];
}

/**
 * Saat formatla (HH:MM)
 */
export function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Geri sayım formatla (HH:MM:SS)
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
