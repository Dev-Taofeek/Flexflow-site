"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import {
  Check,
  Languages,
  Monitor,
  Accessibility as AccessibilityIcon,
  Type,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  usePreferences,
  THEME_OPTIONS,
  FONT_SCALE_OPTIONS,
  FOCUS_VISIBILITY_OPTIONS,
  LANGUAGE_OPTIONS,
} from "@/contexts/PreferencesContext";
import { useI18n } from "@/i18n";

function SectionLabel({ icon: Icon, children }) {
  return (
    <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-(--text-primary)">
      <Icon className="h-3.5 w-3.5 text-brand-500" />
      {children}
    </h3>
  );
}

function RadioList({ options, value, onChange, renderMeta }) {
  return (
    <div className="mt-2.5 grid gap-1.5" role="radiogroup">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
              selected
                ? "border-brand-500/50 bg-brand-500/10"
                : "border-(--border) hover:border-(--border-strong)",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-brand-600 bg-brand-600 text-white" : "border-(--border-strong)",
              )}
            >
              {selected && <Check className="h-2.5 w-2.5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-(--text-primary)">
                {option.label}
              </span>
              {"description" in option && option.description && (
                <span className="mt-0.5 block text-[11px] text-(--text-secondary)">
                  {option.description}
                </span>
              )}
            </span>
            {renderMeta?.(option, selected)}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-lg border border-(--border) px-3 py-2.5 text-left transition-colors hover:border-(--border-strong) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-(--text-primary)">{label}</span>
        <span className="mt-0.5 block text-[11px] text-(--text-secondary)">{description}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-brand-600" : "bg-(--border-strong)",
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}

/**
 * Global appearance & accessibility drawer. Slides in from the right, is small,
 * and every control applies real, application-wide changes via the HTML
 * attributes set by PreferencesContext.
 */
export function SettingsDrawer({ open, onOpenChange }) {
  const {
    theme,
    fontScale,
    language,
    reducedMotion,
    highContrast,
    focusVisibility,
    textSpacing,
    setTheme,
    setFontScale,
    setLanguage,
    setReducedMotion,
    setHighContrast,
    setFocusVisibility,
    setTextSpacing,
  } = usePreferences();
  const { t } = useI18n();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialogEl = dialogRef.current;
    const focusables = () =>
      dialogEl
        ? Array.from(
            dialogEl.querySelectorAll(
              'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => el.offsetParent !== null)
        : [];

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const prevActive = document.activeElement;
    dialogEl?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (prevActive && typeof prevActive.focus === "function") prevActive.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const dialog = (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={t("settingsAppearance.title")}
    >
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 h-full w-full bg-black/40 backdrop-blur-xs"
      />

      <aside
        className={cn(
          "absolute inset-y-0 end-0 flex w-[min(21rem,92vw)] flex-col border-s border-(--border)",
          "bg-(--bg-elevated) shadow-2xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-(--border) px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight text-(--text-primary)">
            {t("settingsAppearance.title")}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t("common.close")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <div>
            <SectionLabel icon={Monitor}>{t("settingsAppearance.themeLabel")}</SectionLabel>
            <RadioList options={THEME_OPTIONS} value={theme} onChange={setTheme} />
          </div>

          <div>
            <SectionLabel icon={Type}>{t("settingsAppearance.fontLabel")}</SectionLabel>
            <RadioList
              options={FONT_SCALE_OPTIONS}
              value={fontScale}
              onChange={setFontScale}
              renderMeta={(o) => (
                <span className="shrink-0 text-[11px] text-(--text-muted)">{o.size}</span>
              )}
            />
          </div>

          <div>
            <SectionLabel icon={Languages}>{t("settingsAppearance.languageLabel")}</SectionLabel>
            <RadioList
              options={LANGUAGE_OPTIONS}
              value={language}
              onChange={setLanguage}
              renderMeta={(o, selected) => (
                <span
                  className={cn(
                    "shrink-0 text-[11px]",
                    selected ? "text-brand-500" : "text-(--text-muted)",
                  )}
                >
                  {o.native}
                </span>
              )}
            />
          </div>

          <div>
            <SectionLabel icon={AccessibilityIcon}>{t("settingsAppearance.accessibility")}</SectionLabel>
            <div className="mt-2.5 space-y-1.5">
              <Toggle
                checked={reducedMotion}
                onChange={setReducedMotion}
                label={t("settingsAppearance.reducedMotion")}
                description={t("settingsAppearance.reducedMotionDescription")}
              />
              <Toggle
                checked={highContrast}
                onChange={setHighContrast}
                label={t("settingsAppearance.highContrastText")}
                description={t("settingsAppearance.highContrastTextDescription")}
              />
              <Toggle
                checked={textSpacing}
                onChange={setTextSpacing}
                label={t("settingsAppearance.textSpacing")}
                description={t("settingsAppearance.textSpacingDescription")}
              />
            </div>

            <div className="mt-3">
              <p className="text-[12px] font-medium text-(--text-primary)">
                {t("settingsAppearance.focusVisibility")}
              </p>
              <div className="mt-2">
                <RadioList
                  options={FOCUS_VISIBILITY_OPTIONS}
                  value={focusVisibility}
                  onChange={setFocusVisibility}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-(--border) px-4 py-3">
          <p className="text-[11px] text-(--text-muted)">
            {t("settingsAppearance.description")}
          </p>
        </div>
      </aside>
    </div>
  );

  return createPortal(dialog, document.body);
}