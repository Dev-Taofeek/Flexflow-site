"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { useI18n } from "@/i18n";

const DISMISS_KEY = "flexflow:push-banner-dismissed";

export function EnablePushBanner() {
    const { t } = useI18n();
    const { permission, subscribe } = usePushSubscription();
    // Read after mount — initializing from localStorage during render would give
    // the client a different tree than SSR (hydration mismatch).
    const [dismissed, setDismissed] = useState(false);
    const [enabling, setEnabling] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1") {
            const timer = setTimeout(() => setDismissed(true), 0);
            return () => clearTimeout(timer);
        }
    }, []);

    if (permission !== "default" || dismissed) return null;

    function dismiss() {
        localStorage.setItem(DISMISS_KEY, "1");
        setDismissed(true);
    }

    async function handleEnable() {
        setEnabling(true);
        try {
            await subscribe();
        } finally {
            setEnabling(false);
            dismiss();
        }
    }

    return (
        <div className="flex items-center gap-3 border-b border-(--border) bg-brand-50 px-4 py-2.5 text-sm dark:bg-brand-950/40">
            <Bell className="h-4 w-4 shrink-0 text-brand-600" />
            <p className="min-w-0 flex-1 truncate text-(--text-primary)">
                {t("shell.push.bannerText")}
            </p>
            <Button size="sm" isLoading={enabling} onClick={handleEnable}>
                {t("shell.push.enable")}
            </Button>
            <button
                type="button"
                onClick={dismiss}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-(--text-muted) transition-colors hover:bg-(--bg-overlay)"
                aria-label={t("shell.action.dismiss")}
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
