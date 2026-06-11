"use client";

import { useCallback, useEffect, useState } from "react";

import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/notifications-api";
import { urlBase64ToUint8Array } from "@/lib/utils";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function usePushSubscription() {
    const { accessToken } = useApp();
    const { addToast } = useToast();
    const [permission, setPermission] = useState(
        typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
    );

    useEffect(() => {
        if (typeof window === "undefined" || !("Notification" in window)) return;
        setPermission(Notification.permission);
    }, []);

    const subscribe = useCallback(async () => {
        if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !VAPID_PUBLIC_KEY) {
            return;
        }
        if (!accessToken) return;

        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            if (result !== "granted") return;

            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });
            }

            await subscribeToPush(subscription.toJSON(), accessToken);
            addToast("Push notifications enabled.", "success");
        } catch {
            addToast("Could not enable push notifications.", "error");
        }
    }, [accessToken, addToast]);

    const unsubscribe = useCallback(async () => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
        if (!accessToken) return;

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (!subscription) return;

            await unsubscribeFromPush(subscription.endpoint, accessToken);
            await subscription.unsubscribe();
        } catch {}
    }, [accessToken]);

    return { permission, subscribe, unsubscribe };
}
