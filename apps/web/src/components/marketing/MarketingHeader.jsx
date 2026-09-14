"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Menu, X, LayoutDashboard, Sparkles } from "lucide-react";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { useI18n } from "@/i18n";

export function Wordmark({ className = "" }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`} aria-label="FlexFlow home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-[15px] font-bold tracking-tight text-white">
        F
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-(--text-primary)">
        FlexFlow
      </span>
    </Link>
  );
}

export function MarketingHeader() {
  const { data: session, status } = useSession();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const authed = status === "authenticated";

  const NAV_LINKS = [
    { label: t("nav.features"), href: "/#features" },
    { label: t("nav.intelligence"), href: "/#intelligence" },
    { label: t("nav.integrations"), href: "/#integrations" },
    { label: t("nav.pricing"), href: "/pricing" },
    { label: t("nav.security"), href: "/#security" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-(--border) bg-(--bg)/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6 lg:px-8">
        <Wordmark />

        <nav className="hidden items-center gap-6 xl:gap-8 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-(--text-secondary) transition-colors hover:text-(--text-primary)"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPrefsOpen(true)}
            aria-label={t("settingsAppearance.title")}
            title={t("settingsAppearance.title")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
          >
            <MonitorIcon />
          </button>

          {authed ? (
            <Link
              href="/dashboard"
              className="hidden items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 sm:inline-flex"
            >
              <LayoutDashboard className="h-4 w-4" />
              {t("common.openDashboard")}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay) hover:text-(--text-primary) md:block"
              >
                {t("common.signIn")}
              </Link>
              <Link
                href="/register"
                className="hidden rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 md:block"
              >
                {t("common.startFree")}
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-(--text-secondary) transition-colors hover:bg-(--bg-overlay) lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-(--border) bg-(--bg) px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay) hover:text-(--text-primary)"
              >
                {item.href.includes("intelligence") && <Sparkles className="h-4 w-4 text-brand-500" />}
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-(--border) pt-3">
            {authed ? (
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
              >
                <LayoutDashboard className="h-4 w-4" /> {t("common.openDashboard")}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-(--border) px-3.5 py-2.5 text-center text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
                >
                  {t("common.signIn")}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-brand-600 px-3.5 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-brand-500"
                >
                  {t("common.startFree")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <SettingsDrawer open={prefsOpen} onOpenChange={setPrefsOpen} />
    </header>
  );
}

function MonitorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4.5 w-4.5"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}