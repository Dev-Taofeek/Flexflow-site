"use client";

import { useState } from "react";
import { Monitor } from "lucide-react";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";

/**
 * Small floating trigger (bottom-right) that opens the appearance &
 * accessibility drawer. Mounted once at the app root so the settings are
 * available everywhere without taking up interface space.
 */
export function FloatingSettingsTrigger() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("settingsAppearance.title")}
        title={t("settingsAppearance.title")}
        className={cn(
          "fixed bottom-5 end-5 z-40 flex h-10 w-10 items-center justify-center rounded-full",
          "border border-(--border) bg-(--bg-elevated) text-(--text-secondary) shadow-lg",
          "transition-all duration-150 hover:scale-105 hover:text-(--text-primary)",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
        )}
      >
        <Monitor className="h-4.5 w-4.5" />
      </button>
      <SettingsDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}