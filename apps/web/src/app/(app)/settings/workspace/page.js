"use client";

import { useI18n } from "@/i18n";
import { WorkspaceSettingsClient } from "@/components/settings/workspace/WorkspaceSettingsClient";

export default function WorkspaceSettingsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-8">
        <p className="text-brand-600 dark:text-brand-400 text-sm font-medium">
          {t("settings.workspace.breadcrumb")}
        </p>

        <h1 className="text-foreground dark:text-foreground-dark mt-2 text-3xl font-semibold tracking-tight">
          {t("settings.workspace.title")}
        </h1>

        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-3 max-w-2xl text-sm leading-relaxed">
          {t("settings.workspace.description")}
        </p>
      </section>

      <WorkspaceSettingsClient />
    </div>
  );
}
