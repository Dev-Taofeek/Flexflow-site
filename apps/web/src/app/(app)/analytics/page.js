"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { fetchAnalytics } from "@/lib/analytics-api";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

export default function AnalyticsPage() {
    const { currentWorkspace, accessToken, isReady } = useApp();
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isReady || !currentWorkspace?.id || !accessToken) return;
        setLoading(true);
        fetchAnalytics(currentWorkspace.id, accessToken)
            .then(setAnalytics)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [currentWorkspace?.id, accessToken, isReady]);

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
                <h1 className="text-xl font-semibold text-(--text-primary)">Analytics</h1>
                <p className="mt-0.5 text-sm text-(--text-muted)">Team performance insights for {currentWorkspace?.name}</p>
            </div>
            <AnalyticsDashboard analytics={analytics} />
        </div>
    );
}
