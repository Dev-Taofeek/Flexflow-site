"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n";

/**
 * Sticky quick-access dock for mobile — sits above the bottom tab bar, off to
 * the right, with a large AI entry point and analytics just below it. Kept off
 * the top bar so the navbar stays clean.
 */
export function MobileAiDock() {
    const { t } = useI18n();
    const pathname = usePathname();
    const aiActive = pathname === "/intelligence";
    const analyticsActive = pathname === "/analytics";

    return (
        <div
            className="fixed bottom-20 right-3 z-40 flex flex-col items-center gap-1.5 md:hidden"
            role="navigation"
            aria-label="Quick access"
        >
            <Link
                href="/intelligence"
                aria-label={t("shell.nav.intelligence")}
                title={t("shell.nav.intelligence")}
                className={[
                    "flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg shadow-brand-600/40 transition-all active:scale-95",
                    aiActive ? "bg-brand-600 ring-2 ring-brand-300" : "bg-gradient-to-br from-brand-500 to-brand-600 hover:from-brand-500 hover:to-brand-500",
                ].join(" ")}
            >
                <Sparkles className="h-6 w-6" strokeWidth={2.25} />
            </Link>
            <Link
                href="/analytics"
                aria-label={t("shell.nav.analytics")}
                title={t("shell.nav.analytics")}
                className={[
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-colors active:scale-95",
                    analyticsActive
                        ? "bg-brand-600 text-white shadow-md shadow-brand-600/30"
                        : "bg-(--bg-elevated) text-(--text-secondary) ring-1 ring-(--border) hover:text-brand-600",
                ].join(" ")}
            >
                <BarChart3 className="h-4.5 w-4.5" />
            </Link>
        </div>
    );
}