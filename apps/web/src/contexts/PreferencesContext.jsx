"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const PreferencesContext = createContext(null);

const STORAGE_KEY = "flexflow:preferences";

/**
 * Curated themes. Every theme maps to CSS variables in globals.css so one
 * selection recolors the entire application. `dark` themes force the `.dark`
 * class; `system` follows the OS; light/dark are the classic pair.
 */
export const THEME_OPTIONS = [
  { id: "system", label: "System", description: "Follow your device" },
  { id: "light", label: "Light", description: "Bright and clean" },
  { id: "dark", label: "Dark", description: "Easy on the eyes" },
  { id: "dim", label: "Dim", description: "Softened dark, less glare" },
  { id: "ocean", label: "Ocean", description: "Calm blue-tinted focus" },
  { id: "midnight", label: "Midnight", description: "Deep navy with violet light" },
  { id: "high-contrast", label: "High Contrast", description: "Maximum readability" },
];

/** Themes that are inherently dark. */
export const DARK_ONLY_THEMES = ["dim", "ocean", "midnight", "high-contrast"];

export const FONT_SCALE_OPTIONS = [
  { id: "sm", label: "Small", size: "14px", description: "More density" },
  { id: "base", label: "Default", size: "16px", description: "Recommended" },
  { id: "lg", label: "Large", size: "18px", description: "Easier reading" },
  { id: "xl", label: "Extra large", size: "20px", description: "Maximum size" },
];

export const FOCUS_VISIBILITY_OPTIONS = [
  { id: "normal", label: "Standard", description: "Subtle focus rings" },
  { id: "high", label: "High visibility", description: "Thicker, brighter rings" },
];

export const LANGUAGE_OPTIONS = [
  { id: "en", label: "English", native: "English" },
  { id: "fr", label: "Français", native: "Français" },
  { id: "es", label: "Español", native: "Español" },
  { id: "pt", label: "Português", native: "Português" },
  { id: "de", label: "Deutsch", native: "Deutsch" },
  { id: "ar", label: "العربية", native: "العربية", rtl: true },
  { id: "zh", label: "中文", native: "中文" },
  { id: "ja", label: "日本語", native: "日本語" },
];

export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_THEME = "system";
export const DEFAULT_FONT_SCALE = "base";

const DEFAULTS = {
  theme: DEFAULT_THEME,
  fontScale: DEFAULT_FONT_SCALE,
  language: DEFAULT_LANGUAGE,
  reducedMotion: false,
  highContrast: false,
  focusVisibility: "normal",
  textSpacing: false,
};

const THEME_IDS = THEME_OPTIONS.map((t) => t.id);
const FONT_SCALE_IDS = FONT_SCALE_OPTIONS.map((f) => f.id);
const FOCUS_VISIBILITY_IDS = FOCUS_VISIBILITY_OPTIONS.map((f) => f.id);
const LANGUAGE_IDS = LANGUAGE_OPTIONS.map((l) => l.id);

export function isDarkTheme(theme, systemPrefersDark) {
  if (DARK_ONLY_THEMES.includes(theme)) return true;
  if (theme === "light") return false;
  if (theme === "dark") return true;
  return systemPrefersDark !== false;
}

/** Normalize raw stored values against allowed option ids. */
function sanitizePrefs(raw) {
  return {
    theme: THEME_IDS.includes(raw?.theme) ? raw.theme : DEFAULT_THEME,
    fontScale: FONT_SCALE_IDS.includes(raw?.fontScale) ? raw.fontScale : DEFAULT_FONT_SCALE,
    language: LANGUAGE_IDS.includes(raw?.language) ? raw.language : DEFAULT_LANGUAGE,
    reducedMotion: Boolean(raw?.reducedMotion),
    highContrast: Boolean(raw?.highContrast),
    focusVisibility: FOCUS_VISIBILITY_IDS.includes(raw?.focusVisibility)
      ? raw.focusVisibility
      : "normal",
    textSpacing: Boolean(raw?.textSpacing),
  };
}

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : true;
}

/** Apply every preference as real attributes/classes on <html>. */
function applyPreferences(prefs, systemDark, previousRef) {
  const root = document.documentElement;
  const dark = isDarkTheme(prefs.theme, systemDark);
  const rtl = prefs.language === "ar";

  root.classList.toggle("dark", dark);
  root.setAttribute("data-theme", prefs.theme);
  root.setAttribute("data-font-size", prefs.fontScale);
  root.setAttribute("data-focus-visible", prefs.focusVisibility);
  root.setAttribute("data-reduced-motion", prefs.reducedMotion ? "true" : "false");
  root.setAttribute("data-high-contrast", prefs.highContrast ? "true" : "false");
  root.setAttribute("data-text-spacing", prefs.textSpacing ? "true" : "false");
  root.style.colorScheme = dark ? "dark" : "light";

  // Language: set dir + lang. RTL mirrors the entire layout.
  if (previousRef?.lang !== prefs.language) {
    root.setAttribute("lang", prefs.language);
    root.setAttribute("dir", rtl ? "rtl" : "ltr");
  }
}

function readStoredPreferences() {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return sanitizePrefs(JSON.parse(raw));
  } catch {
    return DEFAULTS;
  }
}

export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(() => readStoredPreferences());
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const previous = useRef(null);

  // Sync the document with preferences and persist them for next visit.
  useEffect(() => {
    applyPreferences(preferences, systemDark, previous.current);
    previous.current = { ...preferences, dark: isDarkTheme(preferences.theme, systemDark) };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      /* storage unavailable — still applies for this session */
    }
  }, [preferences, systemDark]);

  // When following "system", react to OS theme changes live.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((theme) => {
    setPreferences((prev) => ({
      ...prev,
      theme: THEME_IDS.includes(theme) ? theme : DEFAULT_THEME,
    }));
  }, []);

  const setFontScale = useCallback((fontScale) => {
    setPreferences((prev) => ({
      ...prev,
      fontScale: FONT_SCALE_IDS.includes(fontScale) ? fontScale : DEFAULT_FONT_SCALE,
    }));
  }, []);

  const setLanguage = useCallback((language) => {
    setPreferences((prev) => ({
      ...prev,
      language: LANGUAGE_IDS.includes(language) ? language : DEFAULT_LANGUAGE,
    }));
  }, []);

  const setReducedMotion = useCallback((value) => {
    setPreferences((prev) => ({ ...prev, reducedMotion: Boolean(value) }));
  }, []);

  const setHighContrast = useCallback((value) => {
    setPreferences((prev) => ({ ...prev, highContrast: Boolean(value) }));
  }, []);

  const setFocusVisibility = useCallback((value) => {
    setPreferences((prev) => ({
      ...prev,
      focusVisibility: FOCUS_VISIBILITY_IDS.includes(value) ? value : "normal",
    }));
  }, []);

  const setTextSpacing = useCallback((value) => {
    setPreferences((prev) => ({ ...prev, textSpacing: Boolean(value) }));
  }, []);

  const updatePreferences = useCallback((patch) => {
    setPreferences((prev) => ({ ...prev, ...sanitizePrefs({ ...prev, ...patch }) }));
  }, []);

  const resolvedTheme = isDarkTheme(preferences.theme, systemDark) ? "dark" : "light";

  const value = useMemo(
    () => ({
      ...preferences,
      resolvedTheme,
      isRTL: preferences.language === "ar",
      setTheme,
      setFontScale,
      setLanguage,
      setReducedMotion,
      setHighContrast,
      setFocusVisibility,
      setTextSpacing,
      updatePreferences,
    }),
    [preferences, resolvedTheme, setTheme, setFontScale, setLanguage, setReducedMotion, setHighContrast, setFocusVisibility, setTextSpacing, updatePreferences],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}