"use client";

/**
 * Real-time translation engine for user-generated content.
 *
 * Unlike the static UI dictionaries (which cover every hardcoded label), this
 * module translates dynamic text — task titles, comments, decision memory,
 * project names, notifications, org names — on the fly into the active UI
 * language using a free auto-detect translation endpoint (Google's public
 * gtx API, with graceful fallback to the original text when offline).
 *
 * It never edits stored data: translation only happens at display time, so a
 * task created by one team member in one language is shown to everyone in
 * their own language while the original stays untouched (and is used for
 * editing/search).
 *
 * Results are cached in memory + localStorage, and identical strings are
 * deduped so the same text is only ever requested once per language.
 */

import { useEffect, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n";

// Locale ids -> provider language codes
const LOCALE_TO_PROVIDER = {
  en: "en",
  fr: "fr",
  es: "es",
  pt: "pt",
  de: "de",
  ar: "ar",
  zh: "zh-CN",
  ja: "ja",
};

const STORAGE_KEY = "flexflow:translations";
const DISABLE_KEY = "flexflow:disableAutoTranslate";
const MAX_CACHE = 3000;

const listeners = new Set();
const cache = new Map(); // key -> string (resolved) or Promise (in-flight)
const order = []; // insertion order of cache keys (for LRU eviction)

// ── persistence ────────────────────────────────────────────────────────────
function loadPersisted() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return;
    for (const [lang, text, value] of entries) {
      if (typeof value !== "string" || !value) continue;
      const key = makeKey(lang, text);
      if (!cache.has(key)) {
        cache.set(key, value);
        order.push(key);
      }
    }
  } catch {
    /* storage unavailable — memory cache is enough */
  }
}

let persistTimer = null;
function persist() {
  if (typeof window === "undefined") return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      if (window.localStorage.getItem(DISABLE_KEY) === "1") return;
      const entries = [];
      for (const key of order) {
        const value = cache.get(key);
        if (typeof value === "string") {
          const sep = key.indexOf("\u0001");
          entries.push([key.slice(0, sep), key.slice(sep + 1), value]);
        }
        if (entries.length >= MAX_CACHE) break;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* ignore quota errors */
    }
  }, 600);
}

function evict() {
  while (order.length > MAX_CACHE) {
    const oldest = order.shift();
    cache.delete(oldest);
  }
}

// ── store plumbing ─────────────────────────────────────────────────────────
function makeKey(lang, text) {
  return `${lang}\u0001${text}`;
}

function subscribeTranslation(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

// ── translation logic ──────────────────────────────────────────────────────
export function isAutoTranslateDisabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DISABLE_KEY) === "1";
}

export function setAutoTranslateDisabled(disabled) {
  if (typeof window === "undefined") return;
  try {
    if (disabled) window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.setItem(DISABLE_KEY, disabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function providerLang(locale) {
  return LOCALE_TO_PROVIDER[locale] || "";
}

export function shouldTranslate(text, targetLocale) {
  if (!text) return false;
  const target = providerLang(targetLocale);
  if (!target) return false;
  const s = String(text).trim();
  if (s.length < 2) return false;
  // Only digits/punctuation/symbols — nothing to translate.
  if (/^[\d\s.,:;!?'"()[\]%$€£฿¥+=/\\#@*&^_|<>~`-]+$/.test(s)) return false;
  // URLs, emails, handles.
  if (/(https?:\/\/|mailto:|\s?@[\w.-]+\.[a-z]{2,})/i.test(s)) return false;
  // All-ASCII text shown in an English UI is already in English.
  if (target === "en" && /^[\x00-\x7F]+$/.test(s)) return false;
  return true;
}

async function fetchGoogle(text, target) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" +
    target +
    "&dt=t&q=" +
    encodeURIComponent(text);
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("translate http " + res.status);
  const data = await res.json();
  const rows = data && data[0];
  if (!Array.isArray(rows)) throw new Error("translate bad response");
  let out = "";
  for (const row of rows) {
    if (Array.isArray(row) && typeof row[0] === "string") out += row[0];
  }
  return out || text;
}

/**
 * Ensure a translation is requested for `text` into `targetLocale`.
 * Dedupes identical (text, locale) pairs — safe to call from render/effects.
 */
export function requestTranslation(text, targetLocale) {
  if (isAutoTranslateDisabled()) return;
  const target = providerLang(targetLocale);
  if (!target || !shouldTranslate(text, targetLocale)) return;
  const s = String(text).trim();
  const key = makeKey(targetLocale, s);
  if (cache.has(key)) return;

  const promise = fetchGoogle(s, target)
    .then((translated) => {
      const result = translated && translated.trim() ? translated : s;
      cache.set(key, result);
      order.push(key);
      evict();
      persist();
      emit();
      return result;
    })
    .catch(() => {
      cache.set(key, s);
      order.push(key);
      evict();
      emit();
      return s;
    });

  cache.set(key, promise);
  order.push(key);
  evict();
}

/**
 * Synchronous snapshot of the current displayed value for `text` in the given
 * locale — the original text until a translation arrives.
 */
export function snapshotValue(text, targetLocale) {
  if (!targetLocale || !text) return text || "";
  const s = String(text);
  const key = makeKey(targetLocale, s);
  const hit = cache.get(key);
  if (typeof hit === "string") return hit;
  return s;
}

/**
 * React hook: display-time translation of dynamic user content. Returns the
 * original text immediately, then the translated text when it arrives.
 */
export function useTranslatedText(text) {
  const { locale } = useI18n();
  const value = useSyncExternalStore(
    subscribeTranslation,
    () => snapshotValue(text, locale),
    () => snapshotValue(text, locale),
  );

  useEffect(() => {
    requestTranslation(String(text ?? ""), locale);
  }, [text, locale]);

  return value;
}

/**
 * JSX helper: <Translated>{someDynamicString}</Translated> — or pass `text`.
 * Renders the original until the live translation arrives.
 */
export function Translated({ text, children, ...rest }) {
  const source = children !== undefined ? String(children) : String(text ?? "");
  const value = useTranslatedText(source);
  return <span {...rest}>{value}</span>;
}

// Load persisted translations once (client only).
if (typeof window !== "undefined") {
  loadPersisted();
}