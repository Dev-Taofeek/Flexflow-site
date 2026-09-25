"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, HardDrive, Loader2 } from "lucide-react";

import { apiRequest } from "@/lib/api-client";
import { apiUrl } from "@/lib/api-url";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { useApp } from "@/contexts/AppContext";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n";

export default function DataRetentionPage() {
    const searchParams = useSearchParams();
    const { currentOrg, accessToken } = useApp();
    const { can } = useEntitlements();
    const { addToast } = useToast();
    const { t } = useI18n();

    const orgId = searchParams.get("orgId") || currentOrg?.id;
    const hasAccess = can("data_retention");

    const [policy, setPolicy] = useState({ retentionDays: null, backupEnabled: false, lastBackupAt: null });
    const [exports, setExports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!orgId || !accessToken || !hasAccess) return;
        let cancelled = false;
        apiRequest(`/retention/organizations/${orgId}/retention`, { token: accessToken, toast: false })
            .then((data) => {
                if (cancelled) return;
                setPolicy(data.policy);
                setExports(data.exports);
            })
            .catch((err) => {
                if (cancelled || err?.code === "PLAN_REQUIRED") return;
                setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [orgId, accessToken, hasAccess]);

    async function savePolicy() {
        if (!orgId || !accessToken) return;
        setSaving(true);
        try {
            const updated = await apiRequest(`/retention/organizations/${orgId}/retention`, {
                token: accessToken,
                method: "PUT",
                body: {
                    retentionDays: policy.retentionDays,
                    backupEnabled: policy.backupEnabled,
                },
            });
            setPolicy((prev) => ({ ...prev, ...updated }));
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setSaving(false);
        }
    }

    async function createExport() {
        if (!orgId || !accessToken) return;
        setExporting(true);
        try {
            const { export: created } = await apiRequest(`/retention/organizations/${orgId}/export`, {
                token: accessToken,
                method: "POST",
            });
            setExports((prev) => [created, ...prev]);
            setPolicy((prev) => ({ ...prev, lastBackupAt: new Date().toISOString() }));
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setExporting(false);
        }
    }

    async function downloadExport(row) {
        if (!orgId || !accessToken) return;
        setDownloadingId(row.id);
        try {
            const res = await fetch(`${apiUrl(`/retention/export/${row.id}`)}?organizationId=${orgId}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) throw new Error("Download failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = row.fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setDownloadingId(null);
        }
    }

    return (
        <div className="space-y-6">
            <UpgradePrompt
                feature="data_retention"
                title={t("settings.data.upgradeTitle")}
                description={t("settings.data.upgradeDescription")}
            />

            {loading ? (
                <div className="h-80 animate-pulse rounded-3xl border border-(--border) bg-(--bg-elevated)" />
            ) : error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            ) : (
                <>
                    <section className="rounded-3xl border border-(--border) p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600/10 text-brand-600">
                                <HardDrive className="h-5 w-5" strokeWidth={1.7} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-(--text-primary)">{t("settings.data.policyTitle")}</h2>
                                <p className="mt-1 text-sm text-(--text-muted)">{t("settings.data.policyDescription")}</p>
                            </div>
                        </div>

                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <label className="block text-sm font-medium text-(--text-primary)">
                                {t("settings.data.retentionDays")}
                                <input
                                    type="number"
                                    min={1}
                                    max={3650}
                                    value={policy.retentionDays ?? ""}
                                    placeholder={t("settings.data.retentionUnlimited")}
                                    onChange={(e) =>
                                        setPolicy((prev) => ({ ...prev, retentionDays: e.target.value === "" ? null : Number(e.target.value) }))
                                    }
                                    className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/40"
                                />
                            </label>

                            <div className="flex items-center justify-between rounded-xl border border-(--border) px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium text-(--text-primary)">{t("settings.data.backupEnabled")}</p>
                                    <p className="mt-0.5 text-xs text-(--text-muted)">
                                        {policy.lastBackupAt ? t("settings.data.lastBackup", { date: new Date(policy.lastBackupAt).toLocaleString() }) : t("settings.data.lastBackupNever")}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={policy.backupEnabled}
                                    onClick={() => setPolicy((prev) => ({ ...prev, backupEnabled: !prev.backupEnabled }))}
                                    className={[
                                        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                                        policy.backupEnabled ? "bg-brand-600" : "bg-(--bg-overlay)",
                                    ].join(" ")}
                                >
                                    <span
                                        className={[
                                            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                                            policy.backupEnabled ? "left-[22px]" : "left-0.5",
                                        ].join(" ")}
                                    />
                                </button>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <button
                                type="button"
                                onClick={savePolicy}
                                disabled={saving}
                                className="inline-flex w-fit items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
                            >
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                {t("settings.common.saveChanges")}
                            </button>
                            <button
                                type="button"
                                onClick={createExport}
                                disabled={exporting}
                                className="inline-flex w-fit items-center gap-2 rounded-xl border border-(--border) px-4 py-2.5 text-sm font-medium text-(--text-primary) transition-colors hover:border-(--border-strong) disabled:opacity-50"
                            >
                                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                {t("settings.data.exportNow")}
                            </button>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-(--border) p-6">
                        <h2 className="text-lg font-semibold text-(--text-primary)">{t("settings.data.exportsTitle")}</h2>
                        <p className="mt-1 text-sm text-(--text-muted)">{t("settings.data.exportsDescription")}</p>

                        {exports.length === 0 ? (
                            <p className="mt-6 rounded-xl border border-dashed border-(--border) p-6 text-center text-sm text-(--text-muted)">
                                {t("settings.data.noExports")}
                            </p>
                        ) : (
                            <ul className="divide-y divide-(--border) mt-4">
                                {exports.map((row) => (
                                    <li key={row.id} className="flex items-center justify-between gap-4 py-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-(--text-primary)">{row.fileName}</p>
                                            <p className="mt-0.5 text-xs text-(--text-muted)">
                                                {new Date(row.createdAt).toLocaleString()} · {formatBytes(row.fileSize)} · {row.requestedBy?.name || "—"}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => downloadExport(row)}
                                            disabled={downloadingId === row.id}
                                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-(--border) px-3 py-1.5 text-xs font-medium text-(--text-primary) transition-colors hover:border-(--border-strong) disabled:opacity-50"
                                        >
                                            {downloadingId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                            {t("settings.data.download")}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}