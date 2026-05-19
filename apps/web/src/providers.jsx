"use client";

import { SessionProvider } from "next-auth/react";
import { AppProvider } from "@/contexts/AppContext";

export function Providers({ children, session }) {
    return (
        <SessionProvider session={session}>
            <AppProvider>{children}</AppProvider>
        </SessionProvider>
    );
}
