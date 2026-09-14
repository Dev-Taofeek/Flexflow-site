"use client";

import { useEffect, useState } from "react";

import { PermissionMatrix } from "@/components/settings/roles/PermissionMatrix";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { useApp } from "@/contexts/AppContext";
import { useEntitlements } from "@/hooks/useEntitlements";
import { fetchRolesData } from "@/lib/roles-api";
import { useI18n } from "@/i18n";

export default function RolesSettingsPage() {
  const { currentWorkspace, accessToken, isReady } = useApp();
  const { t } = useI18n();
  const { can } = useEntitlements();
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canEditMatrix = can("customizable_permissions");

  useEffect(() => {
    if (!isReady || !currentWorkspace?.id || !accessToken) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchRolesData(currentWorkspace.id, accessToken);
        if (!cancelled) setResponse(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken, currentWorkspace?.id, isReady]);

  return (
    <div className="space-y-6">
      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-8">
        <p className="text-brand-600 dark:text-brand-400 text-sm font-medium">{t("settings.roles.breadcrumb")}</p>

        <h1 className="text-foreground dark:text-foreground-dark mt-2 text-3xl font-semibold tracking-tight">
          {t("settings.roles.title")}
        </h1>

        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-3 max-w-2xl text-sm leading-relaxed">
          {t("settings.roles.description")}
        </p>
      </section>

      {loading ? (
        <div className="h-80 animate-pulse rounded-3xl border border-(--border) bg-(--bg-elevated)" />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <>
          <UpgradePrompt
            feature="customizable_permissions"
            title={t("settings.roles.upgradeTitle")}
            description={t("settings.roles.upgradeDescription")}
          />
          <PermissionMatrix
            workspaceId={currentWorkspace.id}
            token={accessToken}
            roles={response.roles}
            resources={response.resources}
            initialPermissions={response.permissions}
            canEdit={response.canEdit && canEditMatrix}
          />
        </>
      )}
    </div>
  );
}
