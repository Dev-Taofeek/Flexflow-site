"use client";

import { useEffect, useState } from "react";
import { KeyRound, Link2, Loader2, Trash2 } from "lucide-react";

import { apiRequest } from "@/lib/api-client";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { useApp } from "@/contexts/AppContext";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n";

const EMPTY_FORM = { discoveryUrl: "", clientId: "", clientSecret: "", domain: "", enabled: true };

export default function SsoSettingsPage() {
    const { currentOrg, accessToken, isReady } = useApp();
    const { isAdmin } = useRole();
    const { addToast } = useToast();
    const { t } = useI18n();

    const orgId = currentOrg?.id;

    const [sso, setSso] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isReady || !orgId || !accessToken) return;
        let cancelled = false;
        apiRequest(`/sso/organizations/${orgId}`, { token: accessToken, toast: false })
            .then((data) => {
                if (cancelled) return;
                const current = data.sso;
                setSso(current);
                if (current) {
                    setForm({
                        discoveryUrl: current.discoveryUrl,
                        clientId: current.clientId,
                        clientSecret: "",
                        domain: current.domain,
                        enabled: current.enabled,
                    });
                }
            })
            .catch((err) => {
                if (cancelled || err?.code === "PLAN_REQUIRED") return;
                setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [isReady, orgId, accessToken]);

    async function saveSso() {
        if (!orgId || !accessToken) return;
        if (!form.discoveryUrl.startsWith("https://") || !form.clientId.trim() || !form.domain.includes(".")) {
            addToast(t("settings.sso.fieldsRequired"), "error");
            return;
        }
        setSaving(true);
        try {
            const data = await apiRequest(`/sso/organizations/${orgId}`, {
                token: accessToken,
                method: "PUT",
                body: {
                    discoveryUrl: form.discoveryUrl.trim(),
                    clientId: form.clientId.trim(),
                    ...(form.clientSecret.trim() ? { clientSecret: form.clientSecret.trim() } : {}),
                    domain: form.domain.trim(),
                    enabled: form.enabled,
                },
            });
            setSso(data.sso);
            setForm((prev) => ({ ...prev, clientSecret: "" }));
            addToast(t("settings.sso.saved"), "success");
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setSaving(false);
        }
    }

    async function removeSso() {
        if (!orgId || !accessToken) return;
        setRemoving(true);
        try {
            await apiRequest(`/sso/organizations/${orgId}`, {
                token: accessToken,
                method: "DELETE",
            });
            setSso(null);
            setForm(EMPTY_FORM);
            setConfirmRemove(false);
            addToast(t("settings.sso.removed"), "success");
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setRemoving(false);
        }
    }

    return (
        <div className="space-y-6">
            <UpgradePrompt
                feature="sso"
                title={t("settings.sso.upgradeTitle")}
                description={t("settings.sso.upgradeDescription")}
            />

            {loading ? (
                <div className="h-80 animate-pulse rounded-3xl border border-(--border) bg-(--bg-elevated)" />
            ) : error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            ) : (
                <section className="rounded-3xl border border-(--border) bg-(--bg-elevated) p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600/10 text-brand-600">
                            <KeyRound className="h-5 w-5" strokeWidth={1.7} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-(--text-primary)">{t("settings.sso.title")}</h2>
                            <p className="mt-1 text-sm text-(--text-muted)">{t("settings.sso.description")}</p>
                        </div>
                    </div>

                    {!sso ? (
                        <p className="mt-6 rounded-xl border border-dashed border-(--border) p-6 text-center text-sm text-(--text-muted)">
                            {t("settings.sso.notConfigured")}
                        </p>
                    ) : (
                        <p className="mt-6 flex items-center gap-2 rounded-xl border border-(--border) bg-(--bg) px-4 py-3 text-sm text-(--text-secondary)">
                            <Link2 className="h-4 w-4 shrink-0" />
                            {t("settings.sso.configuredForDomain", { domain: sso.domain })}
                        </p>
                    )}

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-(--text-primary)">
                            {t("settings.sso.discoveryUrlLabel")}
                            <input
                                type="url"
                                value={form.discoveryUrl}
                                placeholder="https://accounts.google.com/.well-known/openid-configuration"
                                onChange={(e) => setForm((prev) => ({ ...prev, discoveryUrl: e.target.value }))}
                                className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-1.5 w-full rounded-xl border px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-brand-500/40 sm:col-span-2"
                            />
                        </label>
                        <label className="block text-sm font-medium text-(--text-primary)">
                            {t("settings.sso.clientIdLabel")}
                            <input
                                type="text"
                                value={form.clientId}
                                onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
                                className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/40"
                            />
                        </label>
                        <label className="block text-sm font-medium text-(--text-primary)">
                            {t("settings.sso.clientSecretLabel")}
                            <input
                                type="password"
                                autoComplete="off"
                                value={form.clientSecret}
                                placeholder={sso?.haveSecret ? "••••••••••••" : t("settings.sso.clientSecretPlaceholder")}
                                onChange={(e) => setForm((prev) => ({ ...prev, clientSecret: e.target.value }))}
                                className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/40"
                            />
                            <span className="mt-1 block text-xs text-(--text-muted)">
                                {sso?.haveSecret ? t("settings.sso.clientSecretHintPresent") : t("settings.sso.clientSecretHint")}
                            </span>
                        </label>
                        <label className="block text-sm font-medium text-(--text-primary)">
                            {t("settings.sso.domainLabel")}
                            <input
                                type="text"
                                value={form.domain}
                                placeholder="company.com"
                                onChange={(e) => setForm((prev) => ({ ...prev, domain: e.target.value }))}
                                className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/40"
                            />
                            <span className="mt-1 block text-xs text-(--text-muted)">{t("settings.sso.domainHint")}</span>
                        </label>
                        {sso ? (
                            <div className="flex items-center justify-between rounded-xl border border-(--border) px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium text-(--text-primary)">{t("settings.sso.enabledLabel")}</p>
                                    <p className="mt-0.5 text-xs text-(--text-muted)">{t("settings.sso.enabledDescription")}</p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={form.enabled}
                                    onClick={() => setForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
                                    className={[
                                        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                                        form.enabled ? "bg-brand-600" : "bg-(--bg-overlay)",
                                    ].join(" ")}
                                >
                                    <span
                                        className={[
                                            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                                            form.enabled ? "left-[22px]" : "left-0.5",
                                        ].join(" ")}
                                    />
                                </button>
                            </div>
                        ) : null}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={saveSso}
                            disabled={saving || !isAdmin || !orgId}
                            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {sso ? t("settings.common.saveChanges") : t("settings.sso.saveAndEnable")}
                        </button>
                        {sso && isAdmin ? (
                            !confirmRemove ? (
                                <button
                                    type="button"
                                    onClick={() => setConfirmRemove(true)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    {t("settings.sso.remove")}
                                </button>
                            ) : (
                                <>
                                    <span className="text-sm text-(--text-muted)">{t("settings.sso.removeConfirm")}</span>
                                    <button
                                        type="button"
                                        onClick={removeSso}
                                        disabled={removing}
                                        className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                                    >
                                        {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        {t("settings.sso.removeConfirmAction")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmRemove(false)}
                                        className="rounded-xl border border-(--border) px-4 py-2.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
                                    >
                                        {t("common.cancel")}
                                    </button>
                                </>
                            )
                        ) : null}
                    </div>
                </section>
            )}
        </div>
    );
}