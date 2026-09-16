"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n";

export function AuthShell({ title, description, children }) {
  const { t } = useI18n();
  return (
    <main className="bg-background dark:bg-background-dark relative flex min-h-screen overflow-hidden">
      {/* Ambient background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.10),transparent_45%)]" />
      </div>

      {/* Brand panel */}
      <aside className="relative z-10 hidden w-full max-w-[560px] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-violet-800 p-12 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.25) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-sm font-bold backdrop-blur-sm">
              FF
            </div>
            <div>
              <p className="text-base font-semibold">{t("common.appName")}</p>
              <p className="text-xs text-white/70">{t("auth.platformTagline")}</p>
            </div>
          </div>

          <div className="mt-20 max-w-sm">
            <h1 className="text-4xl leading-tight font-semibold tracking-tight">
              {t("auth.sidebarHeadline")}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/80">
              {t("auth.sidebarDescription")}
            </p>
          </div>

          <div className="mt-10 max-w-sm rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <div className="bg-white/30 mt-2 h-3 w-3 shrink-0 rounded-full" />
              <div>
                <p className="text-sm leading-relaxed">{t("auth.testimonialQuote")}</p>
                <p className="mt-2 text-xs font-medium text-white/70">
                  {t("auth.testimonialAttribution")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
          <p>{t("landing.noCreditCard")}</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-white">
              {t("common.privacy")}
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white">
              {t("common.terms")}
            </Link>
          </div>
        </div>
      </aside>

      {/* Form column */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10 sm:px-10">
        {/* Mobile brand header */}
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <div className="bg-brand-600 dark:bg-brand-500 flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm">
            FF
          </div>
          <div>
            <p className="text-foreground dark:text-foreground-dark text-sm font-semibold">
              {t("common.appName")}
            </p>
            <p className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
              {t("auth.platformTagline")}
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="border-border bg-surface/90 dark:border-border-dark dark:bg-surface-dark/90 shadow-xl rounded-3xl border p-8 backdrop-blur-xl sm:p-10">
            <div className="mb-8">
              <h2 className="text-foreground dark:text-foreground-dark text-3xl font-semibold tracking-tight">
                {title}
              </h2>
              <p className="text-muted-foreground dark:text-muted-foreground-dark mt-2 text-sm leading-relaxed">
                {description}
              </p>
            </div>

            {children}
          </div>

          <p className="text-muted-foreground dark:text-muted-foreground-dark mt-8 text-center text-xs">
            © {new Date().getFullYear()} {t("common.appName")}
          </p>
        </motion.div>
      </div>
    </main>
  );
}