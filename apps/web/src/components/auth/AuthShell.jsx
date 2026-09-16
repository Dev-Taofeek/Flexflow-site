"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/i18n";

export function AuthShell({ title, description, children }) {
  const { t } = useI18n();
  return (
    <main className="bg-background dark:bg-background-dark relative flex min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_45%)] dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_45%)]" />

      <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark relative z-10 hidden w-full max-w-[520px] flex-col justify-between border-r px-12 py-10 lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-brand-600 dark:bg-brand-500 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold text-white shadow-sm">
              FF
            </div>

            <div>
              <p className="text-foreground dark:text-foreground-dark text-sm font-medium">
                {t("common.appName")}
              </p>

              <p className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                {t("auth.platformTagline")}
              </p>
            </div>
          </div>

          <div className="mt-16 max-w-sm">
            <h1 className="text-foreground dark:text-foreground-dark text-4xl font-semibold tracking-tight">
              {t("auth.sidebarHeadline")}
            </h1>

            <p className="text-muted-foreground dark:text-muted-foreground-dark mt-5 text-base leading-relaxed">
              {t("auth.sidebarDescription")}
            </p>
          </div>
        </div>

        <div className="border-border bg-background/80 dark:border-border-dark dark:bg-background-dark/80 rounded-2xl border p-5 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="from-brand-500 to-brand-700 h-11 w-11 rounded-full bg-gradient-to-br" />

            <div>
              <p className="text-foreground dark:text-foreground-dark text-sm font-medium">
                {t("auth.testimonialQuote")}
              </p>

              <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                {t("auth.testimonialAttribution")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-10 sm:px-8">
        <motion.div
          initial={{
            opacity: 0,
            y: 24,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.35,
            ease: "easeOut",
          }}
          className="w-full max-w-md"
        >
          <div className="border-border bg-surface/90 dark:border-border-dark dark:bg-surface-dark/90 rounded-3xl border p-8 shadow-md backdrop-blur-xl">
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
        </motion.div>
      </div>
    </main>
  );
}
