"use client";

import { useEffect, useMemo, useState } from "react";
import {
    CheckCircle2,
    Copy,
    Link2,
    Loader2,
    Plug,
    PlugZap,
    Plus,
    RefreshCw,
    ShieldCheck,
    Trash2,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { useI18n, dictionaries } from "@/i18n";
import { useEntitlements } from "@/hooks/useEntitlements";
import {
    connectIntegration,
    createAutomation,
    createMapping,
    deleteAutomation,
    deleteMapping,
    disconnectIntegration,
    fetchAutomations,
    fetchIntegrations,
    fetchMappings,
    testIntegration,
    toggleIntegration,
    updateAutomation,
} from "@/lib/integrations-api";
import { getApiBaseUrl } from "@/lib/api-url";
import { fetchProjects } from "@/lib/projects-api";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";

function GitHubIcon({ className = "h-5 w-5" }) {
    return (
        <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
    );
}

function SlackIcon({ className = "h-5 w-5" }) {
    return (
        <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm6.312 6.312a2.528 2.528 0 0 1 2.522 2.522A2.528 2.528 0 0 1 15.146 15.165a2.528 2.528 0 0 1-2.522-2.52v-2.521h2.522zm0-1.271a2.528 2.528 0 0 1-2.522-2.521 2.528 2.528 0 0 1 2.522-2.521h6.312A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-6.312zm-6.312-6.312A2.528 2.528 0 0 1 15.146 0a2.528 2.528 0 0 1 2.522 2.522v2.52h-2.522zm0 1.271a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v6.312z" />
        </svg>
    );
}

function FigmaIcon({ className = "h-5 w-5" }) {
    return (
        <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0 0v8a4 4 0 1 1 0-8ZM12 12h4a4 4 0 1 1-4 4v-4Z" />
            <path d="M8 12a4 4 0 1 0 0 8V12Zm4-8v8H8a4 4 0 1 1 0-8h4Z" />
        </svg>
    );
}

const STATUS_LABEL = { TODO: "To do", IN_PROGRESS: "In progress", IN_REVIEW: "In review", BLOCKED: "Blocked", DONE: "Done" };

const PROVIDERS = {
    github: {
        feature: "github_integration",
        labelKey: "settings.integrations.githubLabel",
        descKey: "settings.integrations.githubDescription",
        icon: GitHubIcon,
        webhookPath: "/integrations/webhooks/webhooks/github",
        webhookSecretKey: "webhookSecret",
        webhookSecretLabelKey: "settings.integrations.webhookSecretLabel",
        webhookHintKey: "settings.integrations.webhookHintGithub",
        resourceTypes: ["repository", "pull_request", "issue", "check"],
        defaultResourceType: "repository",
        triggerOptions: ["github.pr.opened", "github.pr.merged", "github.pr.review_requested", "github.check"],
        defaultTrigger: "github.pr.opened",
    },
    slack: {
        feature: "slack_integration",
        labelKey: "settings.integrations.slackLabel",
        descKey: "settings.integrations.slackDescription",
        icon: SlackIcon,
        webhookPath: "/integrations/webhooks/webhooks/slack",
        webhookSecretKey: "webhookSigningSecret",
        webhookSecretLabelKey: "settings.integrations.webhookSigningSecretLabel",
        webhookHintKey: "settings.integrations.webhookHintSlack",
        resourceTypes: ["channel"],
        defaultResourceType: "channel",
        triggerOptions: ["slack.message"],
        defaultTrigger: "slack.message",
    },
    figma: {
        feature: "figma_integration",
        labelKey: "settings.integrations.figmaLabel",
        descKey: "settings.integrations.figmaDescription",
        icon: FigmaIcon,
        webhookPath: "/integrations/webhooks/webhooks/figma",
        webhookSecretKey: "webhookPasscode",
        webhookSecretLabelKey: "settings.integrations.webhookPasscodeLabel",
        webhookHintKey: "settings.integrations.webhookHintFigma",
        resourceTypes: ["file"],
        defaultResourceType: "file",
        triggerOptions: ["figma.comment", "figma.file_update", "figma.var_publish"],
        defaultTrigger: "figma.comment",
    },
};

const AUTOMATION_ACTIONS = ["task_status", "comment", "notify", "link"];

export default function IntegrationsSettingsPage() {
    const { currentOrg, currentWorkspace, accessToken, isReady } = useApp();
    const { addToast } = useToast();
    const { t, locale } = useI18n();
    const { can } = useEntitlements();

    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState({});
    const [tokens, setTokens] = useState({ github: "", slack: "", figma: "" });
    const [secrets, setSecrets] = useState({ github: "", slack: "", figma: "" });

    const [automations, setAutomations] = useState([]);
    const [mappings, setMappings] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loadingRules, setLoadingRules] = useState(false);
    const [rulesError, setRulesError] = useState("");
    const [showAddAutomation, setShowAddAutomation] = useState(false);
    const [showAddMapping, setShowAddMapping] = useState(false);
    const [automationForm, setAutomationForm] = useState({ provider: "github", trigger: "github.pr.opened", action: "task_status", status: "DONE", message: "" });
    const [mappingForm, setMappingForm] = useState({ provider: "github", resourceType: "repository", resourceId: "", targetProjectId: "" });

    const orgId = currentOrg?.id;
    const workspaceId = currentWorkspace?.id;
    const workspaceName = currentWorkspace?.name || "";

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
        if (!isReady || !orgId || !workspaceId || !accessToken) return;
        let cancelled = false;
        (async () => {
            setLoadingRules(true);
            setRulesError("");
            try {
                const [automationData, mappingData] = await Promise.all([
                    fetchAutomations(orgId, workspaceId, accessToken),
                    fetchMappings(orgId, workspaceId, accessToken),
                ]);
                if (!cancelled) {
                    setAutomations(automationData || []);
                    setMappings(mappingData || []);
                }
            } catch (err) {
                if (!cancelled) setRulesError(err.message);
            } finally {
                if (!cancelled) setLoadingRules(false);
            }
        })();
        return () => { cancelled = true; };
    }, [isReady, orgId, workspaceId, accessToken]);

    useEffect(() => {
        if (!isReady || !workspaceId || !accessToken) return;
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchProjects({ workspaceId, token: accessToken });
                if (!cancelled) setProjects(data || []);
            } catch {
                if (!cancelled) setProjects([]);
            }
        })();
        return () => { cancelled = true; };
    }, [isReady, workspaceId, accessToken]);

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
            const data = await connectIntegration({
                orgId,
                provider,
                token,
                ...(secretKey === "webhookSecret" ? { webhookSecret: secret } : {}),
                ...(secretKey === "webhookSigningSecret" ? { webhookSigningSecret: secret } : {}),
                ...(secretKey === "webhookPasscode" ? { webhookPasscode: secret } : {}),
            });
            setConnections((prev) => {
                const rest = prev.filter((c) => c.provider !== provider);
                return [...rest, data.connection];
            });
            addToast(t("settings.integrations.connectedToast", { provider: t(meta.labelKey) }), "success");
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setTokens((s) => ({ ...s, [provider]: "" }));
            setSecrets((s) => ({ ...s, [provider]: "" }));
            setBusy((s) => ({ ...s, [`connect:${provider}`]: false }));
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
            await disconnectIntegration(conn.id, accessToken);
            setConnections((prev) => prev.filter((c) => c.id !== conn.id));
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setBusy((s) => ({ ...s, [`disconnect:${conn.id}`]: false }));
        }
    }

    async function handleCreateAutomation() {
        if (!workspaceId) return;
        setBusy((s) => ({ ...s, "automation:create": true }));
        try {
            const actionConfig =
                automationForm.action === "task_status"
                    ? { status: automationForm.status }
                    : automationForm.action === "comment"
                      ? { message: automationForm.message }
                      : undefined;
            await createAutomation({
                organizationId: orgId,
                workspaceId,
                provider: automationForm.provider,
                trigger: automationForm.trigger,
                action: automationForm.action,
                actionConfig,
                token: accessToken,
            });
            const data = await fetchAutomations(orgId, workspaceId, accessToken);
            setAutomations(data || []);
            setShowAddAutomation(false);
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setBusy((s) => ({ ...s, "automation:create": false }));
        }
    }

    async function handleToggleAutomation(rule) {
        setBusy((s) => ({ ...s, [`automation:toggle:${rule.id}`]: true }));
        try {
            const updated = await updateAutomation(rule.id, {
                workspaceId,
                enabled: !rule.enabled,
                token: accessToken,
            });
            setAutomations((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setBusy((s) => ({ ...s, [`automation:toggle:${rule.id}`]: false }));
        }
    }

    async function handleDeleteAutomation(rule) {
        setBusy((s) => ({ ...s, [`automation:delete:${rule.id}`]: true }));
        try {
            await deleteAutomation(rule.id, workspaceId, accessToken);
            setAutomations((prev) => prev.filter((r) => r.id !== rule.id));
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setBusy((s) => ({ ...s, [`automation:delete:${rule.id}`]: false }));
        }
    }

    async function handleCreateMapping() {
        if (!workspaceId) return;
        setBusy((s) => ({ ...s, "mapping:create": true }));
        try {
            await createMapping({
                organizationId: orgId,
                workspaceId,
                provider: mappingForm.provider,
                externalResourceType: mappingForm.resourceType,
                externalResourceId: mappingForm.resourceId.trim(),
                projectId: mappingForm.targetProjectId || undefined,
                token: accessToken,
            });
            const data = await fetchMappings(orgId, workspaceId, accessToken);
            setMappings(data || []);
            setShowAddMapping(false);
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setBusy((s) => ({ ...s, "mapping:create": false }));
        }
    }

    async function handleDeleteMapping(mapping) {
        setBusy((s) => ({ ...s, [`mapping:delete:${mapping.id}`]: true }));
        try {
            await deleteMapping(mapping.id, workspaceId, accessToken);
            setMappings((prev) => prev.filter((m) => m.id !== mapping.id));
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setBusy((s) => ({ ...s, [`mapping:delete:${mapping.id}`]: false }));
        }
    }

    function changeAutomationProvider(provider) {
        const meta = PROVIDERS[provider];
        setAutomationForm((s) => ({
            ...s,
            provider,
            trigger: meta.defaultTrigger,
        }));
    }

    function changeMappingProvider(provider) {
        const meta = PROVIDERS[provider];
        setMappingForm((s) => ({
            ...s,
            provider,
            resourceType: meta.defaultResourceType,
        }));
    }

    const triggerLabel = (trigger) => {
        const dict = dictionaries[locale] || dictionaries.en;
        return dict?.settings?.integrations?.triggerLabels?.[trigger] || trigger;
    };

    const actionLabel = useMemo(
        () => (action) => t(`settings.integrations.actionLabels.${action}`),
        [t],
    );

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
                                            </div>
                                            <p className="mt-1 text-sm text-(--text-muted)">{t(meta.descKey)}</p>
                                        </div>
                                    </div>

                                    <div className="mt-5">
                                        {!conn ? (
                                            <div className="flex flex-col gap-3">
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

            <section className="rounded-3xl border border-(--border) bg-(--bg-elevated) p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight text-(--text-primary)">
                            {t("settings.integrations.automationsTitle")}
                        </h2>
                        <p className="mt-1 text-sm text-(--text-muted)">
                            {t("settings.integrations.automationsDescription", { workspace: workspaceName })}
                        </p>
                    </div>
                </div>

                {rulesError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{rulesError}</div>}

                {loadingRules ? (
                    <div className="mt-6 h-24 animate-pulse rounded-xl border border-(--border) bg-(--bg)" />
                ) : (
                    <>
                        <div className="mt-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-(--text-secondary)">
                                    {t("settings.integrations.automationsHeading")}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setShowAddAutomation((s) => !s)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-(--border) bg-(--bg) px-3 py-1.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
                                >
                                    <Plus className="h-4 w-4" />
                                    {t("settings.integrations.addAutomation")}
                                </button>
                            </div>

                            {showAddAutomation && (
                                <div className="mt-3 rounded-xl border border-(--border) bg-(--bg) p-4">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        <div>
                                            <label className="text-xs font-medium text-(--text-muted)">
                                                {t("settings.integrations.automationProvider")}
                                            </label>
                                            <select
                                                value={automationForm.provider}
                                                onChange={(e) => changeAutomationProvider(e.target.value)}
                                                className="mt-1 w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
                                            >
                                                {Object.entries(PROVIDERS).map(([p, meta]) => (
                                                    <option key={p} value={p}>{t(meta.labelKey)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-(--text-muted)">
                                                {t("settings.integrations.automationTrigger")}
                                            </label>
                                            <select
                                                value={automationForm.trigger}
                                                onChange={(e) => setAutomationForm((s) => ({ ...s, trigger: e.target.value }))}
                                                className="mt-1 w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
                                            >
                                                {PROVIDERS[automationForm.provider].triggerOptions.map((tg) => (
                                                    <option key={tg} value={tg}>{triggerLabel(tg)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-(--text-muted)">
                                                {t("settings.integrations.automationAction")}
                                            </label>
                                            <select
                                                value={automationForm.action}
                                                onChange={(e) => setAutomationForm((s) => ({ ...s, action: e.target.value }))}
                                                className="mt-1 w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
                                            >
                                                {AUTOMATION_ACTIONS.map((action) => (
                                                    <option key={action} value={action}>
                                                        {t(`settings.integrations.actionLabels.${action}`)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {automationForm.action === "task_status" ? (
                                            <div>
                                                <label className="text-xs font-medium text-(--text-muted)">
                                                    {t("settings.integrations.statusToSet")}
                                                </label>
                                                <select
                                                    value={automationForm.status}
                                                    onChange={(e) => setAutomationForm((s) => ({ ...s, status: e.target.value }))}
                                                    className="mt-1 w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
                                                >
                                                    {Object.entries(STATUS_LABEL).map(([status, label]) => (
                                                        <option key={status} value={status}>{label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : automationForm.action === "comment" ? (
                                            <div>
                                                <label className="text-xs font-medium text-(--text-muted)">
                                                    {t("settings.integrations.commentMessage")}
                                                </label>
                                                <input
                                                    value={automationForm.message}
                                                    onChange={(e) => setAutomationForm((s) => ({ ...s, message: e.target.value }))}
                                                    className="mt-1 w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
                                                />
                                            </div>
                                        ) : (
                                            <div className="hidden lg:block" />
                                        )}
                                    </div>
                                    <div className="mt-4 flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddAutomation(false)}
                                            className="rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm font-medium text-(--text-secondary) hover:bg-(--bg-overlay)"
                                        >
                                            {t("settings.integrations.cancel")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCreateAutomation}
                                            disabled={busy["automation:create"]}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            {busy["automation:create"] ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Plus className="h-4 w-4" />
                                            )}
                                            {t("settings.integrations.save")}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {automations.length === 0 ? (
                                <p className="mt-3 rounded-xl border border-dashed border-(--border) bg-(--bg) p-4 text-sm text-(--text-muted)">
                                    {t("settings.integrations.noAutomations")}
                                </p>
                            ) : (
                                <ul className="mt-3 space-y-2">
                                    {automations.map((rule) => (
                                        <li
                                            key={rule.id}
                                            className="flex flex-wrap items-center gap-3 rounded-xl border border-(--border) bg-(--bg) px-4 py-3"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="flex items-center gap-2 text-sm text-(--text-primary)">
                                                    <span className="font-medium">{t(PROVIDERS[rule.provider]?.labelKey || rule.provider)}</span>
                                                    <span className="text-(--text-muted)">→</span>
                                                    <code className="font-mono text-xs text-(--text-secondary)">{triggerLabel(rule.trigger)}</code>
                                                </p>
                                                <p className="mt-0.5 text-xs text-(--text-muted)">
                                                    {actionLabel(rule.action)}
                                                    {rule.action === "task_status" && rule.actionConfig?.status
                                                        ? ` → ${STATUS_LABEL[rule.actionConfig.status] || rule.actionConfig.status}`
                                                        : ""}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleAutomation(rule)}
                                                disabled={busy[`automation:toggle:${rule.id}`]}
                                                className={[
                                                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                                                    rule.enabled
                                                        ? "border-(--border) bg-(--bg) text-(--text-secondary) hover:bg-(--bg-overlay)"
                                                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                                                ].join(" ")}
                                            >
                                                {rule.enabled
                                                    ? t("settings.integrations.disable")
                                                    : t("settings.integrations.enable")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteAutomation(rule)}
                                                disabled={busy[`automation:delete:${rule.id}`]}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="mt-8">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-(--text-secondary)">
                                    {t("settings.integrations.mappingsHeading")}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setShowAddMapping((s) => !s)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-(--border) bg-(--bg) px-3 py-1.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
                                >
                                    <Plus className="h-4 w-4" />
                                    {t("settings.integrations.addMapping")}
                                </button>
                            </div>

                            {showAddMapping && (
                                <div className="mt-3 rounded-xl border border-(--border) bg-(--bg) p-4">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        <div>
                                            <label className="text-xs font-medium text-(--text-muted)">
                                                {t("settings.integrations.automationProvider")}
                                            </label>
                                            <select
                                                value={mappingForm.provider}
                                                onChange={(e) => changeMappingProvider(e.target.value)}
                                                className="mt-1 w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
                                            >
                                                {Object.entries(PROVIDERS).map(([p, meta]) => (
                                                    <option key={p} value={p}>{t(meta.labelKey)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-(--text-muted)">
                                                {t("settings.integrations.resourceType")}
                                            </label>
                                            <select
                                                value={mappingForm.resourceType}
                                                onChange={(e) => setMappingForm((s) => ({ ...s, resourceType: e.target.value }))}
                                                className="mt-1 w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
                                            >
                                                {PROVIDERS[mappingForm.provider].resourceTypes.map((type) => (
                                                    <option key={type} value={type}>{t(`settings.integrations.resourceTypeLabels.${type}`)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-(--text-muted)">
                                                {t("settings.integrations.resourceId")}
                                            </label>
                                            <input
                                                value={mappingForm.resourceId}
                                                onChange={(e) => setMappingForm((s) => ({ ...s, resourceId: e.target.value }))}
                                                placeholder="owner/repo, C01234…, file key"
                                                className="mt-1 w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-(--text-muted)">
                                                {t("settings.integrations.linkToProject")}
                                            </label>
                                            <select
                                                value={mappingForm.targetProjectId}
                                                onChange={(e) => setMappingForm((s) => ({ ...s, targetProjectId: e.target.value }))}
                                                className="mt-1 w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
                                            >
                                                <option value="">{t("settings.integrations.noProject")}</option>
                                                {projects.map((project) => (
                                                    <option key={project.id} value={project.id}>{project.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddMapping(false)}
                                            className="rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm font-medium text-(--text-secondary) hover:bg-(--bg-overlay)"
                                        >
                                            {t("settings.integrations.cancel")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCreateMapping}
                                            disabled={busy["mapping:create"] || !mappingForm.resourceId.trim()}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            {busy["mapping:create"] ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Plus className="h-4 w-4" />
                                            )}
                                            {t("settings.integrations.save")}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {mappings.length === 0 ? (
                                <p className="mt-3 rounded-xl border border-dashed border-(--border) bg-(--bg) p-4 text-sm text-(--text-muted)">
                                    {t("settings.integrations.noMappings")}
                                </p>
                            ) : (
                                <ul className="mt-3 space-y-2">
                                    {mappings.map((mapping) => (
                                        <li
                                            key={mapping.id}
                                            className="flex flex-wrap items-center gap-3 rounded-xl border border-(--border) bg-(--bg) px-4 py-3"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="flex items-center gap-2 text-sm text-(--text-primary)">
                                                    <span className="font-medium">{t(PROVIDERS[mapping.provider]?.labelKey || mapping.provider)}</span>
                                                    <code className="font-mono text-xs text-(--text-secondary)">
                                                        {mapping.externalResourceType}:{mapping.externalResourceId}
                                                    </code>
                                                </p>
                                                <p className="mt-0.5 text-xs text-(--text-muted)">
                                                    {mapping.project?.name
                                                        ? `${t("settings.integrations.project")}: ${mapping.project.name}`
                                                        : mapping.task?.key
                                                          ? `${t("settings.integrations.task")}: ${mapping.task.key}`
                                                          : t("settings.integrations.workspaceScoped")}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteMapping(mapping)}
                                                disabled={busy[`mapping:delete:${mapping.id}`]}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}