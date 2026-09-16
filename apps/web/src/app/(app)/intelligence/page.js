"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
    Activity, BookOpenCheck, Bot, ChevronRight, CircleAlert, FileText, GitPullRequestArrow,
    Handshake, Loader2, MessageSquareQuote, Paperclip, Search, Sparkles, Users,
} from "lucide-react";

import { apiUrl } from "@/lib/api-url";
import { useApp } from "@/contexts/AppContext";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useRole } from "@/hooks/useRole";
import { apiRequest } from "@/lib/api-client";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { useI18n } from "@/i18n";
import { Translated } from "@/lib/translate";

const SAMPLE_PROMPT_KEYS = [
    "intelligence.sample.launchStatus",
    "intelligence.sample.blockedTasks",
    "intelligence.sample.checkoutAssignee",
    "intelligence.sample.typescriptDecision",
];

const SOURCE_META = {
    project:   { labelKey: "intelligence.source.project", icon: FileText },
    task:      { labelKey: "intelligence.source.task", icon: GitPullRequestArrow },
    comment:   { labelKey: "intelligence.source.comment", icon: MessageSquareQuote },
    activity:  { labelKey: "intelligence.source.activity", icon: Activity },
    knowledge: { labelKey: "intelligence.source.knowledge", icon: BookOpenCheck },
};

function StatusPill({ status }) {
    const { t } = useI18n();
    const done = status === "COMPLETED" || status === "DONE";
    const tone =
        done ? "bg-success-500/15 text-success-600" :
        status === "BLOCKED"   ? "bg-danger-500/15 text-danger-600" :
        status === "IN_PROGRESS" ? "bg-brand-500/15 text-brand-500" :
        "bg-(--bg-overlay) text-(--text-muted)";
    const label =
        done ? t("intelligence.status.completed") :
        status === "BLOCKED" ? t("intelligence.status.blocked") :
        status === "IN_PROGRESS" ? t("intelligence.status.inProgress") :
        String(status).toLowerCase().replace(/_/g, " ");
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
            {label}
        </span>
    );
}

export default function IntelligencePage() {
    const { data: session } = useSession();
    const { currentOrg, currentWorkspace, accessToken, isReady } = useApp();
    const { can, limits } = useEntitlements();
    const role = useRole();
    const { t } = useI18n();

    const token = accessToken || session?.user?.accessToken;

    const [status, setStatus] = useState({ loading: true, available: false, fullAccess: false, dailyLimit: Infinity, queryCount: 0, remaining: Infinity });
    const [upsell, setUpsell] = useState(null);
    const [question, setQuestion] = useState("");
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const [history, setHistory] = useState([]);
    const [snapshot, setSnapshot] = useState(null);

    const [entry, setEntry] = useState({ title: "", content: "", tags: "", workspaceId: "" });
    const [saving, setSaving] = useState(false);

    const canReadKnowledge = role.isAdmin && can("team_intelligence_full");

    const loadStatus = useCallback(async () => {
        if (!currentOrg?.id || !token) return;
        try {
            const res = await fetch(apiUrl(`/intelligence/${currentOrg.id}`), {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (res.ok && json.success) {
                setStatus({
                    loading: false,
                    available: true,
                    fullAccess: json.data.fullAccess,
                    dailyLimit: json.data.dailyLimit,
                    queryCount: json.data.usage?.queryCount ?? 0,
                    remaining: json.data.usage?.remaining ?? 0,
                });
                setUpsell(null);
            } else if (json.data?.code === "PLAN_REQUIRED") {
                setStatus({ loading: false, available: false, fullAccess: false, dailyLimit: 0, queryCount: 0, remaining: 0 });
                setUpsell(json.data);
                setResult(null);
            } else {
                setStatus({ loading: false, available: false, fullAccess: false, dailyLimit: 0, queryCount: 0, remaining: 0 });
                setError(json.error?.message || t("intelligence.loadFailed"));
            }
        } catch (err) {
            setStatus({ loading: false, available: false, fullAccess: false, dailyLimit: 0, queryCount: 0, remaining: 0 });
            setError(err.message);
        }
    }, [currentOrg, token, t]);

    const loadSnapshot = useCallback(async () => {
        if (!currentOrg?.id || !currentWorkspace?.id || !token) return;
        try {
            const res = await fetch(apiUrl(`/intelligence/${currentOrg.id}/snapshot?workspaceId=${currentWorkspace.id}`), {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (res.ok && json.success) setSnapshot(json.data);
        } catch {
            // Snapshot is non-fatal; leave null.
        }
    }, [currentOrg, currentWorkspace, token]);

    useEffect(() => {
        if (isReady && currentOrg?.id) {
            const timer = setTimeout(() => { loadStatus(); loadSnapshot(); }, 0);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [isReady, currentOrg, loadStatus, loadSnapshot]);

    const usagePct = useMemo(() => {
        if (status.fullAccess || !Number.isFinite(status.dailyLimit) || status.dailyLimit === 0) return 0;
        return Math.min(100, Math.round((status.queryCount / status.dailyLimit) * 100));
    }, [status]);

    async function runQuery() {
        const query = question.trim();
        if (!query || !currentOrg?.id || !token || running) return;
        setRunning(true);
        setError("");
        setResult(null);
        try {
            const res = await fetch(apiUrl("/intelligence/query"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    organizationId: currentOrg.id,
                    workspaceId: currentWorkspace?.id,
                    query,
                    history: history.slice(-10),
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                if (json.data?.code === "QUERY_LIMIT_REACHED") {
                    setError(json.error?.message || t("intelligence.queryLimitReached"));
                } else if (json.data?.code === "PLAN_REQUIRED") {
                    setStatus((s) => ({ ...s, available: false }));
                    setUpsell(json.data);
                } else {
                    setError(json.error?.message || t("intelligence.queryFailed"));
                }
                return;
            }
            setStatus((s) => ({ ...s, queryCount: json.data.usage?.queryCount ?? s.queryCount, remaining: json.data.usage?.remaining ?? s.remaining }));
            setResult({ question: json.data.question, answer: json.data.answer, sources: json.data.sources || [] });
            setHistory((h) => [...h, { role: "user", content: query }, { role: "assistant", content: json.data.answer }].slice(-10));
        } catch (err) {
            setError(err.message);
        } finally {
            setRunning(false);
        }
    }

    async function saveKnowledge() {
        if (!currentOrg?.id || !token || !entry.title.trim() || !entry.content.trim() || saving) return;
        setSaving(true);
        setError("");
        try {
            await apiRequest("/intelligence/knowledge", {
                method: "POST",
                token,
                body: {
                    organizationId: currentOrg.id,
                    workspaceId: entry.workspaceId || currentWorkspace?.id || null,
                    title: entry.title.trim(),
                    content: entry.content.trim(),
                    groups: [],
                    tags: entry.tags.split(",").map((t) => t.trim()).filter(Boolean),
                },
                successMessage: t("intelligence.knowledgeSaved"),
            });
            setEntry({ title: "", content: "", tags: "", workspaceId: "" });
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    const canAsk = status.available && !status.loading;

    return (
        <div className="space-y-6">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border border-brand-500/30 bg-linear-to-br from-brand-600/15 via-brand-500/5 to-transparent p-6 sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-2xl">
                        <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500">
                            <Sparkles className="h-3.5 w-3.5" /> {t("intelligence.eyebrow")}
                        </p>
                        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-(--text-primary) sm:text-3xl">
                            {t("intelligence.title")}
                        </h1>
                        <p className="mt-3 text-sm leading-relaxed text-(--text-secondary)">
                            {t("intelligence.description")}
                        </p>
                    </div>

                    {canAsk && (
                        <div className="grid shrink-0 grid-cols-3 gap-3 lg:min-w-72">
                            <div className="rounded-2xl border border-(--border) bg-(--bg-elevated)/60 p-4">
                                <p className="text-xs text-(--text-muted)">{t("intelligence.queriesToday")}</p>
                                <p className="mt-1 text-xl font-semibold text-(--text-primary)">{status.queryCount}</p>
                            </div>
                            <div className="rounded-2xl border border-(--border) bg-(--bg-elevated)/60 p-4">
                                <p className="text-xs text-(--text-muted)">{t("intelligence.remaining")}</p>
                                <p className="mt-1 text-xl font-semibold text-(--text-primary)">
                                    {Number.isFinite(status.remaining) ? status.remaining : "∞"}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-(--border) bg-(--bg-elevated)/60 p-4">
                                <p className="text-xs text-(--text-muted)">{t("intelligence.access")}</p>
                                <p className="mt-1 text-xl font-semibold text-(--text-primary)">{status.fullAccess ? t("intelligence.unlimited") : `${status.dailyLimit}/day`}</p>
                            </div>
                        </div>
                    )}
                </div>

                {canAsk && Number.isFinite(status.dailyLimit) && status.dailyLimit > 0 && !status.fullAccess && (
                    <div className="mt-6 max-w-md">
                        <div className="h-1.5 w-full rounded-full bg-(--bg-overlay)">
                            <div
                                className="h-full rounded-full bg-brand-500 transition-all"
                                style={{ width: `${usagePct}%` }}
                            />
                        </div>
                        <p className="mt-2 text-xs text-(--text-muted)">
                            {t("intelligence.queriesLeft", { n: status.dailyLimit - status.queryCount, limit: status.dailyLimit })}
                        </p>
                    </div>
                )}
            </section>

            {/* Query console */}
            <section className="rounded-3xl border border-(--border) bg-(--bg-elevated) p-5 sm:p-6">
                <label htmlFor="intelligence-query" className="text-sm font-semibold text-(--text-primary)">
                    {t("intelligence.askLabel")}
                </label>
                <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-(--border) bg-(--bg-sunken) p-3 focus-within:border-brand-500/60">
                    <textarea
                        id="intelligence-query"
                        rows={2}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                runQuery();
                            }
                        }}
                        placeholder={
                            canAsk
                                ? t("intelligence.askPlaceholder")
                                : t("intelligence.askDisabledPlaceholder")
                        }
                        disabled={!canAsk}
                        className="w-full resize-none bg-transparent text-sm text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-none disabled:opacity-60"
                    />
                    <div className="flex items-center justify-between gap-3">
                        <p className="hidden text-xs text-(--text-tertiary) sm:block">
                            {t("intelligence.searchableHint")}
                        </p>
                        <button
                            type="button"
                            onClick={runQuery}
                            disabled={!canAsk || !question.trim() || running}
                            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            {running ? t("intelligence.searching") : t("intelligence.ask")}
                        </button>
                    </div>
                </div>

                {canAsk && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {SAMPLE_PROMPT_KEYS.map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setQuestion(t(key))}
                                className="rounded-full border border-(--border) px-3 py-1.5 text-xs text-(--text-secondary) transition-colors hover:border-brand-500/50 hover:text-brand-500"
                            >
                                {t(key)}
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {/* Team snapshot */}
            {snapshot && (
                <section className="rounded-3xl border border-(--border) bg-(--bg-elevated) p-5 sm:p-6">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-(--text-primary)">{t("intelligence.snapshot.title")}</h2>
                            <p className="mt-1 text-xs text-(--text-secondary)">{t("intelligence.snapshot.subtitle")}</p>
                        </div>
                        <span className="text-xs text-(--text-tertiary)">
                            {t("intelligence.snapshot.memorySince")} {new Date(snapshot.memoryStart).toLocaleDateString()}
                        </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {[
                            { key: "tasks", value: snapshot.counts.tasks },
                            { key: "projects", value: snapshot.counts.projects },
                            { key: "members", value: snapshot.counts.members },
                            { key: "knowledge", value: snapshot.counts.knowledge },
                            { key: "completed", value: snapshot.counts.completed },
                            { key: "blocked", value: snapshot.counts.blocked, danger: true },
                            { key: "overdue", value: snapshot.counts.overdue, danger: true },
                        ].map((card) => (
                            <div
                                key={card.key}
                                className={`rounded-2xl border p-4 ${card.danger ? "border-danger-500/30 bg-danger-500/5" : "border-(--border) bg-(--bg-sunken)"}`}
                            >
                                <p className="text-xs text-(--text-muted)">{t(`intelligence.snapshot.${card.key}`)}</p>
                                <p className={`mt-1 text-2xl font-semibold ${card.danger ? "text-danger-500" : "text-(--text-primary)"}`}>{card.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-(--text-secondary)">
                        <span className="rounded-full border border-(--border) px-3 py-1">
                            {t("intelligence.snapshot.createdThisWeek")}: <strong className="text-(--text-primary)">{snapshot.createdThisWeek}</strong>
                        </span>
                        <span className="rounded-full border border-(--border) px-3 py-1">
                            {t("intelligence.snapshot.completedThisWeek")}: <strong className="text-(--text-primary)">{snapshot.completedThisWeek}</strong>
                        </span>
                    </div>

                    <div className="mt-6 grid gap-6 lg:grid-cols-3">
                        {snapshot.workload?.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{t("intelligence.snapshot.workload")}</h3>
                                <ul className="mt-3 space-y-2">
                                    {snapshot.workload.map((w) => (
                                        <li key={w.id} className="flex items-center justify-between gap-3 text-sm">
                                            <span className="truncate text-(--text-secondary)">{w.name}</span>
                                            <span className="flex items-center gap-2">
                                                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-(--bg-overlay)">
                                                    <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, w.count * 20)}%` }} />
                                                </span>
                                                <span className="text-xs font-medium text-(--text-primary)">{w.count}</span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {snapshot.projectHealth?.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{t("intelligence.snapshot.projectHealth")}</h3>
                                <ul className="mt-3 space-y-2">
                                    {snapshot.projectHealth.map((p) => (
                                        <li key={p.projectId} className="flex items-center justify-between gap-3 text-sm">
                                            <span className="truncate text-(--text-secondary)">{p.name}</span>
                                            <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${p.riskScore >= 60 ? "bg-danger-500/15 text-danger-600" : "bg-amber-500/15 text-amber-600"}`}>
                                                {p.riskScore}%
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {snapshot.recentActivity?.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{t("intelligence.snapshot.recentActivity")}</h3>
                                <ul className="mt-3 space-y-2">
                                    {snapshot.recentActivity.slice(0, 5).map((a, i) => (
                                        <li key={i} className="text-sm text-(--text-secondary)">
                                            <span className="font-medium text-(--text-primary)">{a.actor}</span>{" "}
                                            {a.action}{" "}
                                            <span className="text-xs text-(--text-tertiary)">{new Date(a.at).toLocaleString()}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-danger-500/30 bg-danger-500/10 p-4 text-sm text-danger-600">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Answer */}
            {upsell && !canAsk && (
                <UpgradePrompt
                    feature="team_intelligence_limited"
                    title={t("intelligence.upgradeLimitedTitle")}
                    description={t("intelligence.upgradeLimitedDescription")}
                />
            )}

            {result && (
                <section className="space-y-4">
                    <div className="rounded-3xl border border-(--border) bg-(--bg-elevated) p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                                {running ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Bot className="h-4.5 w-4.5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium uppercase tracking-wide text-(--text-tertiary)">{t("intelligence.answer")}</p>
                                <p className="mt-2 text-sm leading-relaxed text-(--text-primary)"><Translated>{result.answer}</Translated></p>
                            </div>
                        </div>
                    </div>

                    {result.sources.length > 0 && (
                        <div className="rounded-3xl border border-(--border) bg-(--bg-elevated) p-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-(--text-primary)">{t("intelligence.sourcesCited")}</h3>
                                <span className="text-xs text-(--text-tertiary)">{result.sources.length} {t("intelligence.found")}</span>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {result.sources.map((source, i) => {
                                    const meta = SOURCE_META[source.sourceType] || { labelKey: null, icon: Handshake };
                                    const Icon = meta.icon;
                                    return (
                                        <div
                                            key={`${source.sourceType}-${source.sourceId}-${i}`}
                                            className="flex flex-col gap-3 rounded-2xl border border-(--border) p-4"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-(--border) px-2 py-0.5 text-[11px] font-medium text-(--text-secondary)">
                                                    <Icon className="h-3 w-3" /> {meta.labelKey ? t(meta.labelKey) : source.sourceType}
                                                </span>
                                                <span className="text-[11px] font-medium text-(--text-tertiary)">{t("intelligence.matchPercent", { n: source.relevance })}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-(--text-primary)"><Translated>{source.title}</Translated></p>
                                                <p className="mt-1 text-xs leading-relaxed text-(--text-secondary)"><Translated>{source.snippet}</Translated></p>
                                            </div>
                                            {(source.status || source.assignee || source.tags?.length > 0) && (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {source.status && <StatusPill status={source.status} />}
                                                    {source.assignee && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] text-(--text-muted)">
                                                            <Users className="h-3 w-3" /> {source.assignee}
                                                        </span>
                                                    )}
                                                    {source.tags?.slice(0, 3).map((tag) => (
                                                        <span key={tag} className="inline-flex items-center gap-1 text-[11px] text-(--text-muted)">
                                                            <Paperclip className="h-3 w-3" /> {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => runQuery()}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-400"
                                            >
                                                {t("intelligence.followUp")} <ChevronRight className="h-3 w-3" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </section>
            )}

            {/* Decision memory (CUSTOM) */}
            <section className="rounded-3xl border border-(--border) bg-(--bg-elevated) p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                        <BookOpenCheck className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <div>
                            <h3 className="text-base font-semibold text-(--text-primary)">{t("intelligence.decisionMemory")}</h3>
                            <p className="mt-1 text-sm leading-relaxed text-(--text-secondary)">
                                {t("intelligence.decisionMemoryDescriptionFull")}
                            </p>
                        </div>

                        {canReadKnowledge ? (
                            <div className="mt-5 space-y-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <input
                                        value={entry.title}
                                        onChange={(e) => setEntry((p) => ({ ...p, title: e.target.value }))}
                                        placeholder={t("intelligence.titlePlaceholder")}
                                        className="w-full rounded-xl border border-(--border) bg-(--bg-sunken) px-3.5 py-2.5 text-sm text-(--text-primary) placeholder:text-(--text-tertiary) focus:border-brand-500/60 focus:outline-none"
                                    />
                                    <input
                                        value={entry.workspaceId}
                                        onChange={(e) => setEntry((p) => ({ ...p, workspaceId: e.target.value }))}
                                        placeholder={t("intelligence.workspaceIdPlaceholder")}
                                        className="w-full rounded-xl border border-(--border) bg-(--bg-sunken) px-3.5 py-2.5 text-sm text-(--text-primary) placeholder:text-(--text-tertiary) focus:border-brand-500/60 focus:outline-none"
                                    />
                                </div>
                                <textarea
                                    value={entry.content}
                                    onChange={(e) => setEntry((p) => ({ ...p, content: e.target.value }))}
                                    rows={3}
                                    placeholder={t("intelligence.contentPlaceholder")}
                                    className="w-full resize-none rounded-xl border border-(--border) bg-(--bg-sunken) px-3.5 py-2.5 text-sm text-(--text-primary) placeholder:text-(--text-tertiary) focus:border-brand-500/60 focus:outline-none"
                                />
                                <div className="flex items-center justify-between gap-3">
                                    <input
                                        value={entry.tags}
                                        onChange={(e) => setEntry((p) => ({ ...p, tags: e.target.value }))}
                                        placeholder={t("intelligence.tagsPlaceholder")}
                                        className="w-full max-w-xs rounded-xl border border-(--border) bg-(--bg-sunken) px-3.5 py-2.5 text-sm text-(--text-primary) placeholder:text-(--text-tertiary) focus:border-brand-500/60 focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={saveKnowledge}
                                        disabled={saving || !entry.title.trim() || !entry.content.trim()}
                                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}
                                        {t("intelligence.saveToMemory")}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <UpgradePrompt
                                feature="team_intelligence_full"
                                title={t("intelligence.upgradeFullTitle")}
                                description={role.isAdmin ? t("intelligence.upgradeFullAdminDesc") : t("intelligence.upgradeFullMemberDesc")}
                            />
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}