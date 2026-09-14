"use client";

import { useMemo } from "react";
import Link from "next/link";
import { FEATURES, lowestPlanForFeature } from "@flexflow/plans";
import { Lock, Sparkles, ChevronRight } from "lucide-react";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/i18n";

/**
 * Conversion-focused gate. Renders instead of the protected content when the
 * current org's plan doesn't include `feature`. Mirrors the API's PLAN_REQUIRED
 * responses so the upsell story is identical on both sides.
 */
export function UpgradePrompt({ feature, title, description, className = "" }) {
    const { can, planName } = useEntitlements();
    const { currentOrg } = useApp();
    const { t } = useI18n();

    const meta = useMemo(() => {
        const info = FEATURES[feature];
        const minPlan = lowestPlanForFeature(feature);
        return {
            name: info?.name || t("settings.common.thisFeature"),
            minPlan,
            minPlanLabel: minPlan === "custom" ? t("settings.common.planCustom") : minPlan === "pro" ? t("settings.common.planPro") : t("settings.common.planFree"),
        };
    }, [feature, t]);

    if (can(feature)) return null;

    const billingHref = `/settings/billing${currentOrg ? `?orgId=${currentOrg.id}` : ""}`;

    return (
        <div
            className={`overflow-hidden rounded-2xl border border-dashed border-brand-500/40 bg-(--bg-overlay) ${className}`}
        >
            <div className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-500">
                    <Lock className="h-4.5 w-4.5" />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-(--text-primary)">
                        {title || t("settings.common.upgradeFallbackTitle", { name: meta.name, plan: meta.minPlanLabel })}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-(--text-secondary)">
                        {description || t("settings.common.upgradeFallbackDescription", { plan: planName, name: meta.name.toLowerCase() })}
                    </p>
                </div>

                <Link
                    href={billingHref}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500"
                >
                    <Sparkles className="h-4 w-4" />
                    {t("settings.common.upgradePlan")}
                    <ChevronRight className="h-4 w-4" />
                </Link>
            </div>
        </div>
    );
}