"use client";

import { useEffect, useState } from "react";
import { Loader2, LogOut, Monitor, ShieldCheck } from "lucide-react";

import { apiRequest } from "@/lib/api-client";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { useApp } from "@/contexts/AppContext";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n";

const DEFAULT_POLICY = { ipAllowlistEnabled: false, ipAllowlist: [], sessionMaxAgeDays: 30, passwordMinLength: 8 };

export default function SecuritySettingsPage() {
    const { currentOrg, accessToken, isReady } = useApp();
    const { isAdmin } = useRole();
    const { addToast } = useToast();
    const { t } = useI18n();

    const orgId = currentOrg?.id;

    const [policy, setPolicy] = useState(DEFAULT_POLICY);
    const [ipListText, setIpListText] = useState("");
    const [requireTwoFactor, setRequireTwoFactor] = useState(false);
    const [currentIp, setCurrentIp] = useState("");
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loggingOutAll, setLoggingOutAll] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isReady || !orgId || !accessToken) return;
        let cancelled = false;
        (async () => {
            try {
                const [policyData, sessionsData] = await Promise.all([
                    apiRequest(`/security/organizations/${orgId}/policy`, { token: accessToken, toast: false }),
                    apiRequest(`/security/organizations/${orgId}/sessions`, { token: accessToken, toast: false }),
                ]);
                if (cancelled) return;
                const next = policyData.policy || DEFAULT_POLICY;
                setPolicy(next);
                setIpListText((next.ipAllowlist || []).join("\n"));
                setRequireTwoFactor(policyData.requireTwoFactor || false);
                setCurrentIp(policyData.currentIp || "");
                setSessions(sessionsData.sessions || []);
            } catch (err) {
                if (cancelled || err?.code === "PLAN_REQUIRED") return;
                setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [isReady, orgId, accessToken]);

    async function savePolicy() {
        if (!orgId || !accessToken) return;
        const ipAllowlist = ipListText
            .split(/[\n,]+/)
            .map((entry) => entry.trim())
            .filter(Boolean);
        setSaving(true);
        try {
            const updated = await apiRequest(`/security/organizations/${orgId}/policy`, {
                token: accessToken,
                method: "PUT",
                body: {
                    ipAllowlistEnabled: policy.ipAllowlistEnabled,
                    ipAllowlist,
                    sessionMaxAgeDays: Number(policy.sessionMaxAgeDays),
                    passwordMinLength: Number(policy.passwordMinLength),
                },
            });
            const next = updated.policy;
            setPolicy(next);
            setIpListText((next.ipAllowlist || []).join("\n"));
            addToast(t("settings.security.saved"), "success");
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setSaving(false);
        }
    }

    async function logoutAllSessions() {
        if (!orgId || !accessToken) return;
        setLoggingOutAll(true);
        try {
            await apiRequest(`/security/organizations/${orgId}/sessions/logout-all`, {
                token: accessToken,
                method: "POST",
            });
            setSessions([]);
            addToast(t("settings.security.loggedOutAll"), "success");
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setLoggingOutAll(false);
        }
    }

    return (
        <div className="space-y-6">
            <UpgradePrompt
                feature="advanced_security"
                title={t("settings.security.upgradeTitle")}
                description={t("settings.security.upgradeDescription")}
            />

            {loading ? (
                <div className="h-80 animate-pulse rounded-3xl border border-(--border) bg-(--bg-elevated)" />
            ) : error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            ) : (
                <>
                    <section className="rounded-3xl border border-(--border) bg-(--bg-elevated) p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600/10 text-brand-600">
                                <ShieldCheck className="h-5 w-5" strokeWidth={1.7} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-(--text-primary)">{t("settings.security.policyTitle")}</h2>
                                <p className="mt-1 text-sm text-(--text-muted)">{t("settings.security.policyDescription")}</p>
                            </div>
                        </div>

                        {requireTwoFactor ? (
                            <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                {t("settings.security.requireTwoFactorOn")}
                            </p>
                        ) : (
                            <p className="mt-6 rounded-xl border border-(--border) bg-(--bg) px-4 py-3 text-sm text-(--text-secondary)">
                                {t("settings.security.requireTwoFactorOff")}
                            </p>
                        )}

                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <label className="block text-sm font-medium text-(--text-primary)">
                                {t("settings.security.sessionMaxAgeLabel")}
                                <input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={policy.sessionMaxAgeDays ?? 30}
                                    onChange={(e) => setPolicy((prev) => ({ ...prev, sessionMaxAgeDays: Number(e.target.value) }))}
                                    className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/40"
                                />
                                <span className="mt-1 block text-xs text-(--text-muted)">{t("settings.security.sessionMaxAgeHint")}</span>
                            </label>
                            <label className="block text-sm font-medium text-(--text-primary)">
                                {t("settings.security.passwordMinLengthLabel")}
                                <input
                                    type="number"
                                    min={8}
                                    max={64}
                                    value={policy.passwordMinLength ?? 8}
                                    onChange={(e) => setPolicy((prev) => ({ ...prev, passwordMinLength: Number(e.target.value) }))}
                                    className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/40"
                                />
                                <span className="mt-1 block text-xs text-(--text-muted)">{t("settings.security.passwordMinLengthHint")}</span>
                            </label>
                        </div>

                        <div className="mt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-(--text-primary)">{t("settings.security.ipAllowlistLabel")}</p>
                                    <p className="mt-0.5 text-xs text-(--text-muted)">{t("settings.security.ipAllowlistHint")}</p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={policy.ipAllowlistEnabled}
                                    onClick={() => setPolicy((prev) => ({ ...prev, ipAllowlistEnabled: !prev.ipAllowlistEnabled }))}
                                    className={[
                                        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                                        policy.ipAllowlistEnabled ? "bg-brand-600" : "bg-(--bg-overlay)",
                                    ].join(" ")}
                                >
                                    <span
                                        className={[
                                            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                                            policy.ipAllowlistEnabled ? "left-[22px]" : "left-0.5",
                                        ].join(" ")}
                                    />
                                </button>
                            </div>
                            {policy.ipAllowlistEnabled ? (
                                <>
                                    <textarea
                                        rows={4}
                                        value={ipListText}
                                        onChange={(e) => setIpListText(e.target.value)}
                                        placeholder={"203.0.113.10\n203.0.113.0/24"}
                                        className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-3 w-full rounded-xl border px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-brand-500/40"
                                    />
                                    <p className="mt-1.5 text-xs text-(--text-muted)">
                                        {t("settings.security.ipAllowlistCurrentIp", { ip: currentIp || "—" })}
                                    </p>
                                </>
                            ) : null}
                        </div>

                        <div className="mt-6">
                            <button
                                type="button"
                                onClick={savePolicy}
                                disabled={saving || !isAdmin || !orgId}
                                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                {t("settings.common.saveChanges")}
                            </button>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-(--border) bg-(--bg-elevated) p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-(--text-primary)">{t("settings.security.sessionsTitle")}</h2>
                                <p className="mt-1 text-sm text-(--text-muted)">{t("settings.security.sessionsDescription")}</p>
                            </div>
                            <button
                                type="button"
                                onClick={logoutAllSessions}
                                disabled={loggingOutAll || sessions.length === 0}
                                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loggingOutAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                                {t("settings.security.logoutAll")}
                            </button>
                        </div>

                        {sessions.length === 0 ? (
                            <p className="mt-5 rounded-xl border border-dashed border-(--border) p-6 text-center text-sm text-(--text-muted)">
                                {t("settings.security.noSessions")}
                            </p>
                        ) : (
                            <ul className="divide-y divide-(--border) mt-4">
                                {sessions.map((session) => (
                                    <li key={session.id} className="flex items-center gap-4 py-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--bg-overlay)">
                                            <Monitor className="h-4 w-4 text-(--text-secondary)" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="flex items-center gap-2 text-sm font-medium text-(--text-primary)">
                                                {session.deviceName || t("settings.security.unknownDevice")}
                                                {session.current ? (
                                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                                        {t("settings.security.thisDevice")}
                                                    </span>
                                                ) : null}
                                            </p>
                                            <p className="mt-0.5 text-xs text-(--text-muted)">
                                                {session.ipAddress || "—"}
                                                {" · "}
                                                {session.lastUsedAt
                                                    ? new Date(session.lastUsedAt).toLocaleString()
                                                    : new Date(session.createdAt).toLocaleString()}
                                            </p>
                                        </div>
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