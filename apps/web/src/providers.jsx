"use client";

import { SessionProvider } from "next-auth/react";
import { MotionConfig } from "framer-motion";
import { AppProvider } from "@/contexts/AppContext";
import { PreferencesProvider, usePreferences } from "@/contexts/PreferencesContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { FloatingSettingsTrigger } from "@/components/settings/FloatingSettingsTrigger";
import { I18nProvider } from "@/i18n";

// React 19 warns when a <script> it re-creates during a client render pass,
// including the SSR-hoisted preferences script in the root layout. The script
// is inlined into the HTML during server rendering and executes before
// hydration, so this warning is a false positive.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const consoleError = console.error;
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    consoleError(...args);
  };
}

function MotionPrefs({ children }) {
  const { reducedMotion } = usePreferences();
  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
      {children}
    </MotionConfig>
  );
}

export function Providers({ children, session }) {
  return (
    <SessionProvider session={session}>
      <AppProvider>
        <PreferencesProvider>
          <I18nProvider>
            <MotionPrefs>
              <ToastProvider>
                <NotificationsProvider>
                  <ServiceWorkerRegistration />
                  {children}
                  <FloatingSettingsTrigger />
                </NotificationsProvider>
              </ToastProvider>
            </MotionPrefs>
          </I18nProvider>
        </PreferencesProvider>
      </AppProvider>
    </SessionProvider>
  );
}