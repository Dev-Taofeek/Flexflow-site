"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { useI18n, dictionaries } from "@/i18n";
import {
    createAutomation,
    createMapping,
    deleteAutomation,
    deleteMapping,
    fetchAutomations,
    fetchMappings,
    updateAutomation,
} from "@/lib/integrations-api";
import { fetchProjects } from "@/lib/projects-api";
import { PROVIDERS } from "./integration-providers";

const STATUS_LABEL = { TODO: "To do", IN_PROGRESS: "In progress", IN_REVIEW: "In review", BLOCKED: "Blocked", DONE: "Done" };

const AUTOMATION_ACTIONS = ["task_status", "comment", "notify", "link"];

const INITIAL_AUTOMATION_FORM = { provider: "github", trigger: "github.pr.opened", action: "task_status", status: "DONE", message: "" };
const INITIAL_MAPPING_FORM = { provider: "github", resourceType: "repository", resourceId: "", targetProjectId: "" };

/**
 * Shared automations + mappings editor used by the Integrations page and the
 * dedicated Automations settings page. Fetches its own data, so it can mount
 * anywhere the org/workspace context is present.
 */
export function AutomationsPanel() {
    const { currentOrg, currentWorkspace, accessToken, isReady } = useApp();
    const { addToast } = useToast();
    const { t, locale } = useI18n();

    const [automations, setAutomations] = useState([]);
    const [mappings, setMappings] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loadingRules, setLoadingRules] = useState(false);
    const [rulesError, setRulesError] = useState("");
    const [busy, setBusy] = useState({});
    const [showAddAutomation, setShowAddAutomation] = useState(false);
    const [showAddMapping, setShowAddMapping] = useState(false);
    const [automationForm, setAutomationForm] = useState(INITIAL_AUTOMATION_FORM);
    const [mappingForm, setMappingForm] = useState(INITIAL_MAPPING_FORM);

    const orgId = currentOrg?.id;
    const workspaceId = currentWorkspace?.id;
    const workspaceName = currentWorkspace?.name || "";

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

    const triggerLabel = (trigger) => {
        const dict = dictionaries[locale] || dictionaries.en;
        return dict?.settings?.integrations?.triggerLabels?.[trigger] || trigger;
    };

    const actionLabel = useMemo(
        () => (action) => t(`settings.integrations.actionLabels.${action}`),
        [t],
    );

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

    return (
        <section className="rounded-3xl border border-(--border) bg-(--bg-elevated) p-8">
            <h2 className="text-xl font-semibold tracking-tight text-(--text-primary)">
                {t("settings.integrations.automationsTitle")}
            </h2>
            <p className="mt-1 text-sm text-(--text-muted)">
                {t("settings.integrations.automationsDescription", { workspace: workspaceName })}
            </p>

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
    );
}