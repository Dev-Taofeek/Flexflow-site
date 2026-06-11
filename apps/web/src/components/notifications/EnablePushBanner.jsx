"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { usePushSubscription } from "@/hooks/usePushSubscription";

const DISMISS_KEY = "flexflow:push-banner-dismissed";

export function EnablePushBanner() {
    const { permission, subscribe } = usePushSubscription();
    const [dismissed, setDismissed] = useState(true);
    const [enabling, setEnabling] = useState(false);

    useEffect(() => {
        setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
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
        <div className="flex items-center gap-3 border-b border-(--border) bg-indigo-50 px-4 py-2.5 text-sm dark:bg-indigo-950/40">
            <Bell className="h-4 w-4 shrink-0 text-indigo-600" />
            <p className="min-w-0 flex-1 truncate text-(--text-primary)">
                Turn on notifications to get updates instantly, even when FlexFlow is closed.
            </p>
            <Button size="sm" isLoading={enabling} onClick={handleEnable}>
                Enable
            </Button>
            <button
                type="button"
                onClick={dismiss}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-(--text-muted) transition-colors hover:bg-(--bg-overlay)"
                aria-label="Dismiss"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
