"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { fetchAnalytics } from "@/lib/analytics-api";
import { useEntitlements } from "@/hooks/useEntitlements";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { useI18n } from "@/i18n";
import dynamic from "next/dynamic";

const AnalyticsDashboard = dynamic(
    () => import("@/components/analytics/AnalyticsDashboard").then((m) => m.AnalyticsDashboard),
    {
        loading: () => (
            <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-56 animate-pulse rounded-xl bg-(--border)" />)}
            </div>
        ),
        ssr: false,
    }
);

export default function AnalyticsPage() {
    const { currentWorkspace, accessToken, isReady } = useApp();
    const { t } = useI18n();
    const { can } = useEntitlements();
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!can("advanced_analytics")) {
            return;
        }
        if (!isReady || !currentWorkspace?.id || !accessToken) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const data = await fetchAnalytics(currentWorkspace.id, accessToken);
                if (!cancelled) setAnalytics(data);
            } catch (e) {
                if (!cancelled) setError(e.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [currentWorkspace?.id, accessToken, isReady, can]);

    if (!can("advanced_analytics")) {
        return (
            <div className="space-y-6">
                <UpgradePrompt
                    feature="advanced_analytics"
                    title={t("analytics.upgradeTitle")}
                    description={t("analytics.upgradeDescription")}
                />
            </div>
        );
    }

    if (loading || !isReady) {
        return (
            <div className="space-y-4">
                {[1, 2].map((i) => <div key={i} className="h-56 animate-pulse rounded-xl bg-(--border)" />)}
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-(--border) bg-(--bg-elevated) p-8 text-center">
                <p className="text-sm text-(--text-muted)">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold text-(--text-primary)">{t("analytics.title")}</h1>
                <p className="mt-0.5 text-sm text-(--text-muted)">{t("analytics.subtitle", { workspace: currentWorkspace?.name })}</p>
            </div>
            <AnalyticsDashboard analytics={analytics} />
        </div>
    );
}
