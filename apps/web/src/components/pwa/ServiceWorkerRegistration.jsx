"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
    useEffect(() => {
        if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

        navigator.serviceWorker.register("/sw.js").catch((err) => {
            console.error("Service worker registration failed:", err);
        });
    }, []);

    return null;
}
