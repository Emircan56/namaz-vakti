'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ────────────────────────────────────────────────────────────
// Renk Teması Tanımları
// ────────────────────────────────────────────────────────────

export type ColorThemeKey =
  | 'islamic'    // Yeşil (varsayılan İslam yeşili)
  | 'sultan'     // Mavi (Sultan mavisi)
  | 'hunkar'     // Mor (Hünkâr moru)
  | 'osmanli'    // Bordo (Osmanlı bordosu)
  | 'cinar'      // Teal (Çınar turkuaz)
  | 'kehribar';  // Kehribar (Altın amber)

export interface ColorTheme {
  key: ColorThemeKey;
  label: string;
  icon: string;
  description: string;
  swatch: string;   // Önizleme rengi (CSS class)
  swatchDark: string;
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    key: 'islamic',
    label: 'İslam Yeşili',
    icon: '🕌',
    description: 'Geleneksel İslam yeşili tonu',
    swatch: 'bg-emerald-700',
    swatchDark: 'bg-emerald-500',
  },
  {
    key: 'sultan',
    label: 'Sultan Mavisi',
    icon: '👑',
    description: 'Osmanlı saray mavisi',
    swatch: 'bg-blue-700',
    swatchDark: 'bg-blue-400',
  },
  {
    key: 'hunkar',
    label: 'Hünkâr Moru',
    icon: '🟣',
    description: 'Kraliyet moru tonu',
    swatch: 'bg-purple-700',
    swatchDark: 'bg-purple-400',
  },
  {
    key: 'osmanli',
    label: 'Osmanlı Bordosu',
    icon: '🏰',
    description: 'Derin Osmanlı kırmızısı',
    swatch: 'bg-red-800',
    swatchDark: 'bg-red-500',
  },
  {
    key: 'cinar',
    label: 'Çınar Turkuaz',
    icon: '🌿',
    description: 'Doğanın turkuaz tonu',
    swatch: 'bg-teal-600',
    swatchDark: 'bg-teal-400',
  },
  {
    key: 'kehribar',
    label: 'Kehribar',
    icon: '✨',
    description: 'Sıcak altın amber tonu',
    swatch: 'bg-amber-700',
    swatchDark: 'bg-amber-500',
  },
];

// ────────────────────────────────────────────────────────────
// Context
// ────────────────────────────────────────────────────────────

interface ThemeContextType {
  colorTheme: ColorThemeKey;
  setColorTheme: (theme: ColorThemeKey) => void;
  colorThemeInfo: ColorTheme;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useColorTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useColorTheme must be used within ColorThemeProvider');
  return ctx;
}

// ────────────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'nv-color-theme';

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorThemeKey>(() => {
    if (typeof window === 'undefined') return 'islamic';
    const saved = localStorage.getItem(STORAGE_KEY) as ColorThemeKey | null;
    if (saved && COLOR_THEMES.some(t => t.key === saved)) return saved;
    return 'islamic';
  });

  // DOM'daki tema sınıfını güncelle
  useEffect(() => {
    const root = document.documentElement;
    // Eski tema sınıflarını kaldır
    COLOR_THEMES.forEach(t => root.classList.remove(`theme-${t.key}`));
    // Yeni tema sınıfını ekle
    root.classList.add(`theme-${colorTheme}`);
    localStorage.setItem(STORAGE_KEY, colorTheme);
  }, [colorTheme]);

  // İlk yüklemede tema sınıfını hemen uygula (flash önleme)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(`theme-${colorTheme}`);
  }, []);

  const setColorTheme = useCallback((theme: ColorThemeKey) => {
    setColorThemeState(theme);
  }, []);

  const colorThemeInfo = COLOR_THEMES.find(t => t.key === colorTheme) ?? COLOR_THEMES[0];

  return (
    <ThemeContext.Provider value={{ colorTheme, setColorTheme, colorThemeInfo }}>
      {children}
    </ThemeContext.Provider>
  );
}
