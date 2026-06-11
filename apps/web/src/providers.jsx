"use client";

import { SessionProvider } from "next-auth/react";
import { AppProvider } from "@/contexts/AppContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";

export function Providers({ children, session }) {
    return (
        <SessionProvider session={session}>
            <AppProvider>
                <ToastProvider>
                    <NotificationsProvider>
                        <ServiceWorkerRegistration />
                        {children}
                    </NotificationsProvider>
                </ToastProvider>
            </AppProvider>
        </SessionProvider>
    );
}
