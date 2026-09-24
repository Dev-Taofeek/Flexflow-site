"use client";

import { useEffect, useRef, useState } from "react";
import {
    CheckCircle2,
    Copy,
    ExternalLink,
    Link2,
    Loader2,
    Plug,
    PlugZap,
    RefreshCw,
    ShieldCheck,
    Trash2,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { useStepUp } from "@/contexts/StepUpContext";
import { useI18n } from "@/i18n";
import { useEntitlements } from "@/hooks/useEntitlements";
import { PROVIDERS } from "@/components/settings/integration-providers";
import {
    connectIntegration,
    disconnectIntegration,
    fetchIntegrationProviders,
    fetchIntegrations,
    startIntegrationOAuth,
    testIntegration,
    toggleIntegration,
} from "@/lib/integrations-api";
import { getApiBaseUrl } from "@/lib/api-url";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";

export default function IntegrationsSettingsPage() {
    const { currentOrg, accessToken, isReady } = useApp();
    const { addToast } = useToast();
    const { t } = useI18n();
    const { can } = useEntitlements();
    const { runWithStepUp } = useStepUp();

    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState({});
    const [tokens, setTokens] = useState({ github: "", slack: "", figma: "" });
    const [secrets, setSecrets] = useState({ github: "", slack: "", figma: "" });
    const [providerMeta, setProviderMeta] = useState({});
    const [oauthBusy, setOauthBusy] = useState({});
    const oauthHandled = useRef(false);

    const orgId = currentOrg?.id;

    useEffect(() => {
        if (!isReady || !orgId || !accessToken) return;
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchIntegrations(orgId, accessToken);
                if (!cancelled) setConnections(data.connections || []);
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [isReady, orgId, accessToken]);

    useEffect(() => {
        if (!accessToken) return;
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchIntegrationProviders(accessToken);
                if (cancelled) return;
                const map = {};
                for (const p of data?.providers || []) map[p.id] = p;
                setProviderMeta(map);
            } catch {
                if (!cancelled) setProviderMeta({});
            }
        })();
        return () => { cancelled = true; };
    }, [accessToken]);

    useEffect(() => {
        if (!isReady || !orgId || !accessToken || typeof window === "undefined") return;
        if (oauthHandled.current) return;
        const params = new URLSearchParams(window.location.search);
        const outcome = params.get("integration");
        if (!outcome) return;
        oauthHandled.current = true;
        const provider = params.get("provider");
        const providerLabel = provider
            ? t(PROVIDERS[provider]?.labelKey || provider)
            : "";
        if (outcome === "connected") {
            addToast(t("settings.integrations.oauthConnectedToast", { provider: providerLabel }), "success");
            fetchIntegrations(orgId, accessToken)
                .then((data) => setConnections(data.connections || []))
                .catch(() => {});
        } else if (outcome === "error") {
            addToast(t("settings.integrations.oauthFailedToast", { provider: providerLabel }), "error");
        }
        window.history.replaceState({}, "", window.location.pathname);
    }, [isReady, orgId, accessToken, t, addToast]);

    const connectionFor = (provider) => connections.find((c) => c.provider === provider) || null;

    const webhookUrlFor = (provider) => `${getApiBaseUrl()}${PROVIDERS[provider].webhookPath}`;

    async function copyWebhookUrl(provider) {
        const url = webhookUrlFor(provider);
        try {
            await navigator.clipboard.writeText(url);
            addToast(t("settings.integrations.webhookCopied"), "success");
        } catch {
            addToast(t("settings.integrations.copyFailed"), "error");
        }
    }

    async function handleConnect(provider) {
        const token = (tokens[provider] || "").trim();
        if (!token) {
            addToast(t("settings.integrations.tokenRequired"), "error");
            return;
        }
        const meta = PROVIDERS[provider];
        const secretKey = meta.webhookSecretKey;
        const secret = (secrets[provider] || "").trim();
        setBusy((s) => ({ ...s, [`connect:${provider}`]: true }));
        try {
            const data = await runWithStepUp(({ code }) =>
                connectIntegration({
                    orgId,
                    provider,
                    token,
                    code,
                    ...(secretKey === "webhookSecret" ? { webhookSecret: secret } : {}),
                    ...(secretKey === "webhookSigningSecret" ? { webhookSigningSecret: secret } : {}),
                    ...(secretKey === "webhookPasscode" ? { webhookPasscode: secret } : {}),
                }),
            );
            setConnections((prev) => {
                const rest = prev.filter((c) => c.provider !== provider);
                return [...rest, data.connection];
            });
            addToast(t("settings.integrations.connectedToast", { provider: t(meta.labelKey) }), "success");
        } catch (err) {
            if (!err?.cancelled) addToast(err.message, "error");
        } finally {
            setTokens((s) => ({ ...s, [provider]: "" }));
            setSecrets((s) => ({ ...s, [provider]: "" }));
            setBusy((s) => ({ ...s, [`connect:${provider}`]: false }));
        }
    }

    async function handleOAuth(provider) {
        setOauthBusy((s) => ({ ...s, [provider]: true }));
        try {
            const data = await startIntegrationOAuth(provider, orgId, accessToken);
            if (data?.url) {
                window.location.href = data.url;
                return;
            }
            throw new Error("OAuth is unavailable.");
        } catch (err) {
            addToast(err.message, "error");
            setOauthBusy((s) => ({ ...s, [provider]: false }));
        }
    }

    async function handleToggle(conn, enabled) {
        setBusy((s) => ({ ...s, [`toggle:${conn.id}`]: true }));
        try {
            const data = await toggleIntegration(conn.id, enabled, accessToken);
            setConnections((prev) => prev.map((c) => (c.id === conn.id ? data.connection : c)));
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setBusy((s) => ({ ...s, [`toggle:${conn.id}`]: false }));
        }
    }

    async function handleTest(conn) {
        setBusy((s) => ({ ...s, [`test:${conn.id}`]: true }));
        try {
            const data = await testIntegration(conn.id, accessToken);
            addToast(
                data.account
                    ? t("settings.integrations.testOkWithAccount", { account: data.account })
                    : t("settings.integrations.testOk"),
                "success",
            );
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setBusy((s) => ({ ...s, [`test:${conn.id}`]: false }));
        }
    }

    async function handleDisconnect(conn) {
        setBusy((s) => ({ ...s, [`disconnect:${conn.id}`]: true }));
        try {
            await runWithStepUp(({ code }) => disconnectIntegration(conn.id, accessToken, code));
            setConnections((prev) => prev.filter((c) => c.id !== conn.id));
        } catch (err) {
            if (!err?.cancelled) addToast(err.message, "error");
        } finally {
            setBusy((s) => ({ ...s, [`disconnect:${conn.id}`]: false }));
        }
    }

    return (
        <div className="space-y-6">
            <section className="rounded-3xl border border-(--border) bg-(--bg-elevated) p-8">
                <p className="text-sm font-medium text-brand-600">{t("settings.integrations.breadcrumb")}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-(--text-primary)">
                    {t("settings.integrations.title")}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-(--text-secondary)">
                    {t("settings.integrations.description")}
                </p>
            </section>

            {error && !loading && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            )}

            {loading ? (
                <div className="h-60 animate-pulse rounded-3xl border border-(--border) bg-(--bg-elevated)" />
            ) : (
                <div className="space-y-4">
                    {Object.entries(PROVIDERS).map(([provider, meta]) => {
                        const Icon = meta.icon;
                        const conn = connectionFor(provider);
                        const canFeature = can(meta.feature);

                        return (
                            <div key={provider}>
                                <UpgradePrompt
                                    feature={meta.feature}
                                    title={t("settings.integrations.upgradeTitle", { provider: t(meta.labelKey) })}
                                    description={t("settings.integrations.upgradeDescription", { provider: t(meta.labelKey) })}
                                />
                                <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-6">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--bg-overlay)">
                                            <Icon className="h-5 w-5 text-(--text-secondary)" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-base font-semibold text-(--text-primary)">
                                                    {t(meta.labelKey)}
                                                </h2>
                                                {conn?.enabled ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        {t("settings.integrations.active")}
                                                    </span>
                                                ) : conn ? (
                                                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                                                        {t("settings.integrations.paused")}
                                                    </span>
                                                ) : null}
                                                {conn?.config?.via === "oauth" ? (
                                                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                                                        {t("settings.integrations.viaOauth")}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-1 text-sm text-(--text-muted)">{t(meta.descKey)}</p>
                                        </div>
                                    </div>

                                    <div className="mt-5">
                                        {!conn ? (
                                            <div className="flex flex-col gap-3">
                                                {providerMeta[provider]?.oauthAvailable && canFeature ? (
                                                    <div className="flex flex-col gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOAuth(provider)}
                                                            disabled={oauthBusy[provider] || !providerMeta[provider]?.oauthAvailable}
                                                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-(--border) bg-(--bg) px-4 py-2.5 text-sm font-medium text-(--text-primary) transition-colors hover:bg-(--bg-overlay) disabled:cursor-not-allowed disabled:opacity-40"
                                                        >
                                                            {oauthBusy[provider] ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Icon className="h-4 w-4" />
                                                            )}
                                                            {oauthBusy[provider]
                                                                ? t("settings.integrations.oauthPreparing")
                                                                : t("settings.integrations.connectWithOauth", { provider: t(meta.labelKey) })}
                                                        </button>
                                                        <p className="text-center text-xs text-(--text-muted)">
                                                            {t("settings.integrations.orConnectWithToken")}
                                                        </p>
                                                    </div>
                                                ) : null}
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                                    <input
                                                        type="password"
                                                        autoComplete="off"
                                                        placeholder={t("settings.integrations.tokenPlaceholder")}
                                                        value={tokens[provider]}
                                                        disabled={!canFeature}
                                                        onChange={(e) => setTokens((s) => ({ ...s, [provider]: e.target.value }))}
                                                        className="w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none disabled:opacity-40"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleConnect(provider)}
                                                        disabled={busy[`connect:${provider}`] || !canFeature}
                                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        {busy[`connect:${provider}`] ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Plug className="h-4 w-4" />
                                                        )}
                                                        {t("settings.integrations.connect")}
                                                    </button>
                                                </div>
                                                <input
                                                    type="password"
                                                    autoComplete="off"
                                                    placeholder={t(meta.webhookSecretLabelKey)}
                                                    value={secrets[provider]}
                                                    disabled={!canFeature}
                                                    onChange={(e) => setSecrets((s) => ({ ...s, [provider]: e.target.value }))}
                                                    className="w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none disabled:opacity-40"
                                                />
                                                <p className="text-xs text-(--text-muted)">{t(meta.webhookHintKey)}</p>
                                                <details className="rounded-lg border border-(--border) bg-(--bg) p-3">
                                                    <summary className="cursor-pointer text-xs font-medium text-(--text-secondary)">
                                                        {t("settings.integrations.guidedTitle")}
                                                    </summary>
                                                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-(--text-muted)">
                                                        <li>{t("settings.integrations.guidedStepToken", { provider: t(meta.labelKey) })}</li>
                                                        {providerMeta[provider]?.tokenScopes ? (
                                                            <li>
                                                                {t("settings.integrations.guidedStepScopes", {
                                                                    scopes: providerMeta[provider].tokenScopes,
                                                                })}
                                                            </li>
                                                        ) : null}
                                                        <li>{t("settings.integrations.guidedStepPaste")}</li>
                                                    </ol>
                                                    {providerMeta[provider]?.tokenHelpUrl ? (
                                                        <a
                                                            href={providerMeta[provider].tokenHelpUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-500"
                                                        >
                                                            {t("settings.integrations.createToken")}
                                                            <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    ) : null}
                                                </details>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="flex items-center gap-1.5 text-sm text-(--text-secondary)">
                                                            <Link2 className="h-4 w-4" />
                                                            {conn.config?.account
                                                                ? t("settings.integrations.connectedAs", {
                                                                      account: conn.config.account,
                                                                  })
                                                                : t("settings.integrations.connected")}
                                                            {conn.config?.last4 ? ` ••••${conn.config.last4}` : ""}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-(--text-muted)">
                                                            {t("settings.integrations.connectedBy", { name: conn.connectedBy?.name })}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleTest(conn)}
                                                        disabled={busy[`test:${conn.id}`]}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay) disabled:opacity-50"
                                                    >
                                                        {busy[`test:${conn.id}`] ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <RefreshCw className="h-4 w-4" />
                                                        )}
                                                        {t("settings.integrations.testConnection")}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggle(conn, !conn.enabled)}
                                                        disabled={busy[`toggle:${conn.id}`]}
                                                        className={[
                                                            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                                                            conn.enabled
                                                                ? "border-(--border) bg-(--bg) text-(--text-secondary) hover:bg-(--bg-overlay)"
                                                                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                                                        ].join(" ")}
                                                    >
                                                        {busy[`toggle:${conn.id}`] ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : conn.enabled ? (
                                                            <ShieldCheck className="h-4 w-4" />
                                                        ) : (
                                                            <PlugZap className="h-4 w-4" />
                                                        )}
                                                        {conn.enabled
                                                            ? t("settings.integrations.disable")
                                                            : t("settings.integrations.enable")}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDisconnect(conn)}
                                                        disabled={busy[`disconnect:${conn.id}`]}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                                                    >
                                                        {busy[`disconnect:${conn.id}`] ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                        {t("settings.integrations.disconnect")}
                                                    </button>
                                                </div>
                                                <div className="flex flex-col gap-2 rounded-lg border border-(--border) bg-(--bg) p-3 sm:flex-row sm:items-center">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-medium text-(--text-muted)">
                                                            {t("settings.integrations.webhookUrlLabel")}
                                                        </p>
                                                        <code className="mt-0.5 block break-all font-mono text-xs text-(--text-secondary)">
                                                            {webhookUrlFor(provider)}
                                                        </code>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyWebhookUrl(provider)}
                                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                        {t("settings.integrations.copyWebhookUrl")}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}