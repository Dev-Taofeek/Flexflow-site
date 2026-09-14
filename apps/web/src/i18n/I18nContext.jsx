"use client";

import { createContext, useCallback, useContext, useMemo } from "react";

import { dictionaries } from "./dictionaries";
import { usePreferences } from "@/contexts/PreferencesContext";

const I18nContext = createContext(null);

/**
 * Deep lookup a dotted key (e.g. "auth.welcomeBack") against a dictionary.
 * Falls back to English, then to a humanized version of the key itself so a
 * missing translation never renders an empty string.
 */
function lookup(dict, path) {
  let node = dict;
  for (const segment of path.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = node[segment];
  }
  return typeof node === "string" ? node : undefined;
}

function humanizeKey(key) {
  return key.split(".").pop().replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}

export function I18nProvider({ children }) {
  const { language } = usePreferences();

  const locale = language && dictionaries[language] ? language : "en";
  const dict = dictionaries[locale] || dictionaries.en;

  const t = useCallback(
    (key, variables) => {
      const raw = lookup(dict, key) ?? lookup(dictionaries.en, key) ?? humanizeKey(key);
      if (!variables) return raw;
      return raw.replace(/\{(\w+)\}/g, (match, name) =>
        variables[name] !== undefined ? String(variables[name]) : match,
      );
    },
    [dict],
  );

  const has = useCallback((key) => Boolean(lookup(dict, key)), [dict]);

  const value = useMemo(() => ({ locale, t, has, isRTL: locale === "ar" }), [locale, t, has]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}