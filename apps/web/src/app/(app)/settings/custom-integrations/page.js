"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, PlugZap, RefreshCw, Send, Trash2, Webhook } from "lucide-react";

import { apiRequest } from "@/lib/api-client";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { useApp } from "@/contexts/AppContext";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n";

const EMPTY_FORM = { name: "", url: "", events: [], secret: "" };

const EVENT_KEYS = {
    "task.created": "settings.customIntegrations.events.taskCreated",
    "comment.created": "settings.customIntegrations.events.commentCreated",
    "project.created": "settings.customIntegrations.events.projectCreated",
};

export default function CustomIntegrationsSettingsPage() {
    const { currentOrg, accessToken, isReady } = useApp();
    const { isAdmin } = useRole();
    const { addToast } = useToast();
    const { t } = useI18n();

    const orgId = currentOrg?.id;
    const basePath = orgId ? `/custom-integrations/organizations/${orgId}` : "";

    const [incoming, setIncoming] = useState(null);
    const [webhooks, setWebhooks] = useState([]);
    const [eventOptions, setEventOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [rotating, setRotating] = useState(false);
    const [confirmRotate, setConfirmRotate] = useState(false);

    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState({});
    const [confirmDelete, setConfirmDelete] = useState({});

    const load = useCallback(async () => {
        if (!orgId || !accessToken) return;
        const [incomingData, outboundData] = await Promise.all([
            apiRequest(`/custom-integrations/organizations/${orgId}/incoming`, { token: accessToken, toast: false }),
            apiRequest(`/custom-integrations/organizations/${orgId}/outbound`, { token: accessToken, toast: false }),
        ]);
        setIncoming(incomingData);
        setEventOptions(incomingData.events || []);
        setWebhooks(outboundData.webhooks || []);
    }, [orgId, accessToken]);

    useEffect(() => {
        if (!isReady || !orgId || !accessToken) return;
        let cancelled = false;
        (async () => {
            try {
                await load();
            } catch (err) {
                if (!cancelled && err?.code !== "PLAN_REQUIRED") setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [isReady, orgId, accessToken, load]);

    async function copyText(text, successKey) {
        try {
            await navigator.clipboard.writeText(text);
            addToast(t(successKey), "success");
        } catch {
            addToast(t("settings.integrations.copyFailed"), "error");
        }
    }

    async function rotateToken() {
        if (!orgId || !accessToken) return;
        setRotating(true);
        try {
            const data = await apiRequest(`${basePath}/incoming/rotate`, { token: accessToken, method: "POST" });
            setIncoming((prev) => ({ ...prev, ...data }));
            setConfirmRotate(false);
            addToast(t("settings.customIntegrations.rotated"), "success");
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setRotating(false);
        }
    }

    async function createWebhook() {
        if (!orgId || !accessToken) return;
        if (!form.name.trim() || !/^https?:\/\//i.test(form.url.trim()) || form.events.length === 0) {
            addToast(t("settings.customIntegrations.fieldsRequired"), "error");
            return;
        }
        setSaving(true);
        try {
            const data = await apiRequest(`${basePath}/outbound`, {
                token: accessToken,
                method: "POST",
                body: {
                    name: form.name.trim().slice(0, 80),
                    url: form.url.trim(),
                    events: form.events,
                    ...(form.secret.trim() ? { secret: form.secret.trim() } : {}),
                },
            });
            setWebhooks((prev) => [data.webhook, ...prev]);
            setForm(EMPTY_FORM);
            addToast(t("settings.customIntegrations.webhookAdded"), "success");
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setSaving(false);
        }
    }

    async function toggleWebhook(webhook) {
        setBusy((s) => ({ ...s, [`toggle:${webhook.id}`]: true }));
        try {
            const data = await apiRequest(`${basePath}/outbound/${webhook.id}`, {
                token: accessToken,
                method: "PATCH",
                body: { enabled: !webhook.enabled },
            });
            setWebhooks((prev) => prev.map((w) => (w.id === webhook.id ? { ...webhook, enabled: data.webhook.enabled } : w)));
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setBusy((s) => ({ ...s, [`toggle:${webhook.id}`]: false }));
        }
    }

    async function deleteWebhook(webhook) {
        setBusy((s) => ({ ...s, [`delete:${webhook.id}`]: true }));
        try {
            await apiRequest(`${basePath}/outbound/${webhook.id}`, { token: accessToken, method: "DELETE" });
            setWebhooks((prev) => prev.filter((w) => w.id !== webhook.id));
            setConfirmDelete((prev) => ({ ...prev, [webhook.id]: false }));
            addToast(t("settings.customIntegrations.webhookDeleted"), "success");
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setBusy((s) => ({ ...s, [`delete:${webhook.id}`]: false }));
        }
    }

    async function testWebhook(webhook) {
        setBusy((s) => ({ ...s, [`test:${webhook.id}`]: true }));
        try {
            const data = await apiRequest(`${basePath}/outbound/${webhook.id}/test`, {
                token: accessToken,
                method: "POST",
                body: {},
                toast: false,
            });
            setWebhooks((prev) => prev.map((w) => (w.id === webhook.id ? { ...w, lastStatus: data.status, lastDeliveryAt: data.lastDeliveryAt } : w)));
            addToast(
                data.delivered
                    ? t("settings.customIntegrations.testDeliveryOk")
                    : t("settings.customIntegrations.testDeliveryFailed", { status: data.status || "FAILED" }),
                data.delivered ? "success" : "error",
            );
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setBusy((s) => ({ ...s, [`test:${webhook.id}`]: false }));
        }
    }

    function toggleEvent(event) {
        setForm((prev) => ({
            ...prev,
            events: prev.events.includes(event) ? prev.events.filter((e) => e !== event) : [...prev.events, event],
        }));
    }

    function statusClass(status) {
        if (status === "SUCCESS") return "bg-emerald-100 text-emerald-700";
        if (status && status.startsWith("HTTP_")) return "bg-amber-100 text-amber-700";
        return "bg-red-100 text-red-700";
    }

    return (
        <div className="space-y-6">
            <UpgradePrompt
                feature="custom_integrations"
                title={t("settings.customIntegrations.upgradeTitle")}
                description={t("settings.customIntegrations.upgradeDescription")}
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
                                <Webhook className="h-5 w-5" strokeWidth={1.7} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-(--text-primary)">{t("settings.customIntegrations.incomingTitle")}</h2>
                                <p className="mt-1 text-sm text-(--text-muted)">{t("settings.customIntegrations.incomingDescription")}</p>
                            </div>
                        </div>

                        {incoming ? (
                            <div className="mt-6 rounded-xl border border-(--border) bg-(--bg) p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-(--text-muted)">
                                    {t("settings.customIntegrations.urlLabel")}
                                </p>
                                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <code className="min-w-0 flex-1 break-all font-mono text-xs text-(--text-secondary)">
                                        {incoming.url}
                                    </code>
                                    <button
                                        type="button"
                                        onClick={() => copyText(incoming.url, "settings.customIntegrations.urlCopied")}
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
                                    >
                                        <Copy className="h-4 w-4" />
                                        {t("settings.customIntegrations.copyUrl")}
                                    </button>
                                </div>
                                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-(--text-muted)">
                                    {t("settings.customIntegrations.tokenLabel")}
                                </p>
                                <p className="mt-1 break-all font-mono text-xs text-(--text-secondary)">{incoming.token}</p>
                                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-(--text-muted)">
                                    {t("settings.customIntegrations.eventsLabel")}
                                </p>
                                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                                    {eventOptions.map((event) => (
                                        <li
                                            key={event}
                                            className="rounded-full bg-(--bg-overlay) px-2.5 py-0.5 text-xs font-medium text-(--text-secondary)"
                                        >
                                            {t(EVENT_KEYS[event] || event)}
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-4 text-xs leading-relaxed text-(--text-muted)">
                                    {t("settings.customIntegrations.webhookUrlExplain")}
                                </p>
                            </div>
                        ) : null}

                        <div className="mt-6">
                            {!confirmRotate ? (
                                <button
                                    type="button"
                                    onClick={() => setConfirmRotate(true)}
                                    disabled={!isAdmin || !orgId}
                                    className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    {t("settings.customIntegrations.rotate")}
                                </button>
                            ) : (
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-sm text-(--text-muted)">{t("settings.customIntegrations.rotateConfirm")}</span>
                                    <button
                                        type="button"
                                        onClick={rotateToken}
                                        disabled={rotating}
                                        className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
                                    >
                                        {rotating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                        {t("settings.customIntegrations.rotateConfirmAction")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmRotate(false)}
                                        className="rounded-xl border border-(--border) px-4 py-2.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
                                    >
                                        {t("common.cancel")}
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="rounded-3xl border border-(--border) bg-(--bg-elevated) p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600/10 text-brand-600">
                                <Send className="h-5 w-5" strokeWidth={1.7} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-(--text-primary)">{t("settings.customIntegrations.outboundTitle")}</h2>
                                <p className="mt-1 text-sm text-(--text-muted)">{t("settings.customIntegrations.outboundDescription")}</p>
                            </div>
                        </div>

                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <label className="block text-sm font-medium text-(--text-primary)">
                                {t("settings.customIntegrations.nameLabel")}
                                <input
                                    type="text"
                                    value={form.name}
                                    placeholder={t("settings.customIntegrations.namePlaceholder")}
                                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                    className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/40"
                                />
                            </label>
                            <label className="block text-sm font-medium text-(--text-primary)">
                                {t("settings.customIntegrations.urlLabel")}
                                <input
                                    type="url"
                                    value={form.url}
                                    placeholder={t("settings.customIntegrations.urlPlaceholder")}
                                    onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                                    className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-1.5 w-full rounded-xl border px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-brand-500/40"
                                />
                            </label>
                        </div>

                        <div className="mt-4">
                            <p className="text-sm font-medium text-(--text-primary)">{t("settings.customIntegrations.eventsLabel")}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {eventOptions.map((event) => {
                                    const checked = form.events.includes(event);
                                    return (
                                        <button
                                            key={event}
                                            type="button"
                                            onClick={() => toggleEvent(event)}
                                            className={[
                                                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                                checked
                                                    ? "border-brand-600 bg-brand-600 text-white"
                                                    : "border-(--border) bg-(--bg) text-(--text-secondary) hover:bg-(--bg-overlay)",
                                            ].join(" ")}
                                        >
                                            {t(EVENT_KEYS[event] || event)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <label className="mt-4 block text-sm font-medium text-(--text-primary)">
                            {t("settings.customIntegrations.secretLabel")}
                            <input
                                type="password"
                                autoComplete="off"
                                value={form.secret}
                                placeholder={t("settings.customIntegrations.secretPlaceholder")}
                                onChange={(e) => setForm((prev) => ({ ...prev, secret: e.target.value }))}
                                className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/40"
                            />
                            <span className="mt-1 block text-xs text-(--text-muted)">{t("settings.customIntegrations.secretHint")}</span>
                        </label>

                        <div className="mt-6">
                            <button
                                type="button"
                                onClick={createWebhook}
                                disabled={saving || !isAdmin || !orgId}
                                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                                {t("settings.customIntegrations.addWebhook")}
                            </button>
                        </div>

                        {webhooks.length === 0 ? (
                            <p className="mt-6 rounded-xl border border-dashed border-(--border) p-6 text-center text-sm text-(--text-muted)">
                                {t("settings.customIntegrations.outboundEmpty")}
                            </p>
                        ) : (
                            <ul className="divide-y divide-(--border) mt-6">
                                {webhooks.map((webhook) => (
                                    <li key={webhook.id} className="py-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-(--text-primary)">
                                                    {webhook.name}
                                                    <span
                                                        className={[
                                                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                                                            statusClass(webhook.lastStatus),
                                                        ].join(" ")}
                                                    >
                                                        {webhook.lastStatus || t("settings.customIntegrations.neverDelivered")}
                                                    </span>
                                                    {!webhook.enabled ? (
                                                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                                                            {t("settings.customIntegrations.disabled")}
                                                        </span>
                                                    ) : null}
                                                </p>
                                                <p className="mt-0.5 break-all font-mono text-xs text-(--text-muted)">{webhook.url}</p>
                                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--text-muted)">
                                                    <span>
                                                        {t("settings.customIntegrations.eventsLabel")}:{" "}
                                                        {(webhook.events || []).map((e) => t(EVENT_KEYS[e] || e)).join(", ")}
                                                    </span>
                                                    {webhook.lastDeliveryAt ? (
                                                        <span>
                                                            {t("settings.customIntegrations.lastDeliveryLabel")}:{" "}
                                                            {new Date(webhook.lastDeliveryAt).toLocaleString()}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => testWebhook(webhook)}
                                                    disabled={busy[`test:${webhook.id}`]}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay) disabled:opacity-50"
                                                >
                                                    {busy[`test:${webhook.id}`] ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Send className="h-4 w-4" />
                                                    )}
                                                    {t("settings.customIntegrations.test")}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleWebhook(webhook)}
                                                    disabled={busy[`toggle:${webhook.id}`]}
                                                    className={[
                                                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                                                        webhook.enabled
                                                            ? "border-(--border) bg-(--bg) text-(--text-secondary) hover:bg-(--bg-overlay)"
                                                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                                                    ].join(" ")}
                                                >
                                                    {busy[`toggle:${webhook.id}`] ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : webhook.enabled ? (
                                                        <RefreshCw className="h-4 w-4" />
                                                    ) : (
                                                        <PlugZap className="h-4 w-4" />
                                                    )}
                                                    {webhook.enabled ? t("settings.customIntegrations.disable") : t("settings.customIntegrations.enable")}
                                                </button>
                                                {confirmDelete[webhook.id] ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteWebhook(webhook)}
                                                            disabled={busy[`delete:${webhook.id}`]}
                                                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                                                        >
                                                            {busy[`delete:${webhook.id}`] ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
                                                            )}
                                                            {t("settings.customIntegrations.deleteConfirm")}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmDelete((prev) => ({ ...prev, [webhook.id]: false }))}
                                                            className="rounded-lg border border-(--border) px-3 py-2 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
                                                        >
                                                            {t("common.cancel")}
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmDelete((prev) => ({ ...prev, [webhook.id]: true }))}
                                                        disabled={!isAdmin}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        {t("settings.customIntegrations.delete")}
                                                    </button>
                                                )}
                                            </div>
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