"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Download, Filter, Loader2, ScrollText, ShieldCheck } from "lucide-react";

import { apiRequest } from "@/lib/api-client";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { useEntitlements } from "@/hooks/useEntitlements";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { useI18n } from "@/i18n";

const ACTION_TONES = {
    create: "bg-success-500/15 text-success-700 dark:text-success-400",
    update: "bg-brand-500/15 text-brand-700 dark:text-brand-400",
    delete: "bg-danger-500/15 text-danger-700 dark:text-danger-400",
    read: "bg-(--bg-overlay) text-(--text-secondary)",
    checkout: "bg-brand-500/15 text-brand-700 dark:text-brand-400",
    login: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    downgrade: "bg-warning-500/15 text-warning-700 dark:text-warning-400",
};

function toneFor(action) {
    return ACTION_TONES[String(action).toLowerCase()] || "bg-(--bg-overlay) text-(--text-secondary)";
}

function formatMetadata(metadata) {
    if (!metadata) return null;
    try {
        const text = JSON.stringify(metadata);
        return text.length > 60 ? `${text.slice(0, 60)}…` : text;
    } catch {
        return null;
    }
}

export default function AuditLogsSettingsPage() {
    const searchParams = useSearchParams();
    const addToast = useToast().addToast;
    const { t, locale } = useI18n();
    const { currentOrg, accessToken } = useApp();
    const { can, planName } = useEntitlements();

    const orgId = searchParams.get("orgId") || currentOrg?.id;
    const hasAccess = can("audit_logs");

    const [events, setEvents] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");

    useEffect(() => {
        if (!orgId || !accessToken || !hasAccess) return;
        let cancelled = false;
        const params = new URLSearchParams({ orgId });
        if (filter) params.set("action", filter);
        apiRequest(`/audit?${params.toString()}`, { token: accessToken, toast: false })
            .then((res) => {
                if (cancelled) return;
                setEvents(res.events || []);
                setTotal(res.total || 0);
            })
            .catch((err) => {
                if (!cancelled) addToast(err.message, "error");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [orgId, accessToken, hasAccess, filter, addToast]);

    function exportCsv() {
        const rows = [["time", "actor", "action", "resource", "resource_id", "metadata", "ip"]];
        for (const e of events) {
            rows.push([
                new Date(e.createdAt).toISOString(),
                e.actor?.email || e.actor?.name || "—",
                e.action,
                e.resource,
                e.resourceId || "",
                e.metadata ? JSON.stringify(e.metadata) : "",
                e.ipAddress || "",
            ]);
        }
        const csv = rows
            .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `flexflow-audit-${orgId}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        addToast(t("settings.audit.exported"), "success");
    }

    if (!hasAccess) {
        return (
            <div className="space-y-5">
                <UpgradePrompt
                    feature="audit_logs"
                    title={t("settings.audit.upgradeTitle")}
                    description={t("settings.audit.upgradeDescription", { plan: planName })}
                />
                <div className="rounded-2xl border border-(--border) bg-(--bg-elevated) p-6">
                    <p className="text-sm text-(--text-secondary)">
                        {t("settings.audit.upgradeBody")}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl border border-(--border) bg-(--bg-elevated) p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-500">
                        <ScrollText className="h-4.5 w-4.5" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-(--text-primary)">{t("settings.audit.title")}</p>
                        <p className="mt-0.5 text-xs text-(--text-muted)">
                            {total === 1
                                ? t("settings.audit.recordCountOne", { count: total.toLocaleString() })
                                : t("settings.audit.recordCountMany", { count: total.toLocaleString() })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--text-tertiary)" />
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            aria-label={t("settings.audit.filterAria")}
                            className="h-9 rounded-lg border border-(--border) bg-(--bg) pl-8 pr-3 text-xs text-(--text-secondary) focus:border-brand-500 focus:outline-none"
                        >
                            <option value="">{t("settings.audit.allActions")}</option>
                            {["create", "update", "delete", "read", "checkout", "login", "downgrade"].map((a) => (
                                <option key={a} value={a}>{t(`settings.audit.action.${a}`)}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        onClick={exportCsv}
                        disabled={events.length === 0}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-(--border) px-3 text-xs font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay) disabled:opacity-40"
                    >
                        <Download className="h-3.5 w-3.5" />
                        {t("settings.audit.exportCsv")}
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-(--border)">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-20 text-sm text-(--text-muted)">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("settings.audit.loading")}
                    </div>
                ) : events.length === 0 ? (
                    <div className="flex flex-col items-center py-20 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-(--border) bg-(--bg-overlay)">
                            <ShieldCheck className="h-6 w-6 text-(--text-tertiary)" />
                        </div>
                        <p className="mt-4 text-sm font-medium text-(--text-primary)">
                            {filter ? t("settings.audit.noEventsFilter") : t("settings.audit.noEvents")}
                        </p>
                        <p className="mt-1 max-w-xs text-xs text-(--text-muted)">
                            {t("settings.audit.noEventsHint")}
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-(--border)">
                        {events.map((event) => (
                            <li key={event.id} className="flex flex-col gap-1.5 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-3">
                                <span
                                    className={[
                                        "inline-flex w-16 shrink-0 justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold capitalize",
                                        toneFor(event.action),
                                    ].join(" ")}
                                >
                                    {event.action}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-(--text-primary)">
                                        {event.resource}
                                        {event.resourceId ? (
                                            <span className="ml-1.5 font-mono text-xs text-(--text-tertiary)">
                                                {event.resourceId.slice(0, 10)}
                                            </span>
                                        ) : null}
                                    </p>
                                    <p className="truncate font-mono text-xs text-(--text-muted)">
                                        {formatMetadata(event.metadata) || "—"}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-3 text-xs text-(--text-muted)">
                                    <span className="whitespace-nowrap">
                                        {event.actor?.name || event.actor?.email || t("settings.audit.system")}
                                    </span>
                                    <span className="whitespace-nowrap">
                                        {new Date(event.createdAt).toLocaleString(locale)}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <Link
                href="/settings/billing"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-400"
            >
                {t("settings.audit.viewPlan")} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
        </div>
    );
}