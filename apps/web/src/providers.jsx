"use client";

import { SessionProvider } from "next-auth/react";
import { AppProvider } from "@/contexts/AppContext";
import { ToastProvider } from "@/contexts/ToastContext";

export function Providers({ children, session }) {
    return (
        <SessionProvider session={session}>
            <AppProvider>
                <ToastProvider>{children}</ToastProvider>
            </AppProvider>
        </SessionProvider>
    );
}
