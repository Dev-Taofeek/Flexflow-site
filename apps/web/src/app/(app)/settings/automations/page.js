"use client";

import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { AutomationsPanel } from "@/components/settings/AutomationsPanel";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useI18n } from "@/i18n";

export default function AutomationsSettingsPage() {
    const { t } = useI18n();
    const { can } = useEntitlements();

    return (
        <div className="space-y-6">
            <section className="rounded-3xl border border-(--border) bg-(--bg-elevated) p-8">
                <p className="text-sm font-medium text-brand-600">{t("settings.automations.breadcrumb")}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-(--text-primary)">
                    {t("settings.automations.title")}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-(--text-secondary)">
                    {t("settings.automations.description")}
                </p>
            </section>

            {can("automation") ? (
                <AutomationsPanel />
            ) : (
                <UpgradePrompt
                    feature="automation"
                    title={t("settings.automations.upgradeTitle")}
                    description={t("settings.automations.upgradeDescription")}
                />
            )}
        </div>
    );
}