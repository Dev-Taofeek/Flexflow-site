"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
    AlertCircle, CalendarDays, Check, ChevronDown, CircleDot,
    Filter, Loader2, Plus, RefreshCw, X,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useRole } from "@/hooks/useRole";
import { apiRequest } from "@/lib/api-client";
import { fetchProjects } from "@/lib/projects-api";
import { useI18n } from "@/i18n";

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const STATUS_COLOR = {
    TODO: "bg-zinc-400",
    IN_PROGRESS: "bg-blue-500",
    IN_REVIEW: "bg-amber-500",
    DONE: "bg-emerald-500",
};
const PRIORITY_COLOR = {
    LOW: "text-zinc-500 bg-zinc-100",
    MEDIUM: "text-blue-600 bg-blue-50",
    HIGH: "text-orange-600 bg-orange-50",
    URGENT: "text-red-600 bg-red-50",
};

function formatDate(d) {
    if (!d) return null;
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AssigneeAvatars({ task }) {
    const { t } = useI18n();
    const people = (task.assignees || []).map((a) => a.user).filter(Boolean);
    if (people.length === 0 && task.assignee) people.push(task.assignee);
    if (people.length === 0) return null;
    return (
        <span className="flex items-center gap-1">
            <div className="flex -space-x-1">
                {people.slice(0, 3).map((u) => (
                    <div
                        key={u.id}
                        title={u.name}
                        className="flex h-4 w-4 items-center justify-center rounded-full border border-(--bg-elevated) bg-brand-100 text-[9px] font-bold text-brand-700"
                    >
                        {u.name?.[0]?.toUpperCase()}
                    </div>
                ))}
            </div>
            {people.length === 1
                ? <span className="truncate max-w-24">{people[0].name}</span>
                : <span>{t("tasks.assigneeCount", { n: people.length })}</span>
            }
        </span>
    );
}

function MultiAssigneePicker({ members, selected, onChange }) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);

    function toggle(id) {
        onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    }

    const label = selected.length === 0
        ? t("tasks.unassigned")
        : selected.length === 1
            ? (members.find((m) => m.user.id === selected[0])?.user.name ?? t("tasks.oneAssignee"))
            : t("tasks.assigneeCount", { n: selected.length });

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-1 rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-secondary) focus:outline-none"
            >
                <span className="truncate">{label}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-(--text-muted)" />
            </button>
            {open && (
                <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-(--border) bg-(--bg-elevated) py-1 shadow-lg">
                    {members.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-(--text-muted)">{t("tasks.noMembers")}</p>
                    ) : (
                        members.map((m) => {
                            const checked = selected.includes(m.user.id);
                            return (
                                <button
                                    key={m.user.id}
                                    type="button"
                                    onClick={() => toggle(m.user.id)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-(--bg-overlay)"
                                >
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 shrink-0">
                                        {m.user.name?.[0]?.toUpperCase()}
                                    </div>
                                    <span className="flex-1 text-left text-(--text-primary)">{m.user.name}</span>
                                    {checked && <Check className="h-3.5 w-3.5 text-brand-600" />}
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

export default function TasksPage() {
    const { currentWorkspace, currentWorkspaceId, currentOrg, accessToken, isReady } = useApp();
    const { canManageTasks } = useRole();
    const { t } = useI18n();

    const statusLabel = (status) =>
        ({
            TODO: t("tasks.status.todo"),
            IN_PROGRESS: t("tasks.status.in_progress"),
            IN_REVIEW: t("tasks.status.in_review"),
            DONE: t("tasks.status.done"),
        }[status]);

    const priorityLabel = (priority) =>
        ({
            LOW: t("tasks.priority.low"),
            MEDIUM: t("tasks.priority.medium"),
            HIGH: t("tasks.priority.high"),
            URGENT: t("tasks.priority.urgent"),
        }[priority]);

    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [members, setMembers] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // filters
    const [statusFilter, setStatusFilter] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");
    const [assigneeFilter, setAssigneeFilter] = useState("");

    // create form
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ title: "", description: "", projectId: "", priority: "MEDIUM", status: "TODO", dueDate: "" });
    const [assigneeIds, setAssigneeIds] = useState([]);
    const [formError, setFormError] = useState("");

    const loadTasks = useCallback(async () => {
        if (!isReady || !currentWorkspaceId || !accessToken) return;
        setLoading(true);
        setError(null);
        try {
            const params = { workspaceId: currentWorkspaceId };
            if (statusFilter) params.status = statusFilter;
            if (priorityFilter) params.priority = priorityFilter;
            if (assigneeFilter) params.assigneeId = assigneeFilter;
            const data = await apiRequest("/tasks", { token: accessToken, params });
            setTasks(data.tasks);
            setTotal(data.total);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [isReady, currentWorkspaceId, accessToken, statusFilter, priorityFilter, assigneeFilter]);

    useEffect(() => {
        let cancelled = false;
        (async () => { await loadTasks(); })();
        return () => { cancelled = true; };
    }, [loadTasks]);

    useEffect(() => {
        if (!isReady || !currentWorkspaceId || !accessToken) return;
        fetchProjects({ workspaceId: currentWorkspaceId, token: accessToken })
            .then(setProjects)
            .catch(() => {});
        if (currentOrg?.id) {
            apiRequest(`/organizations/${currentOrg.id}/members`, { token: accessToken })
                .then((data) => setMembers((data.members || []).map((m) => ({ user: m.user, role: m.role }))))
                .catch(() => {});
        }
    }, [isReady, currentWorkspaceId, currentOrg?.id, accessToken]);

    async function handleCreate(e) {
        e.preventDefault();
        if (!form.title.trim()) { setFormError(t("tasks.titleRequired")); return; }
        if (!form.projectId) { setFormError(t("tasks.selectProjectRequired")); return; }
        setFormError("");
        setCreating(true);
        try {
            const task = await apiRequest("/tasks", {
                method: "POST",
                token: accessToken,
                body: {
                    ...form,
                    assigneeIds,
                    dueDate: form.dueDate || null,
                },
            });
            setTasks((prev) => [task, ...prev]);
            setTotal((t) => t + 1);
            setForm({ title: "", description: "", projectId: "", priority: "MEDIUM", status: "TODO", dueDate: "" });
            setAssigneeIds([]);
            setShowCreate(false);
        } catch (err) {
            setFormError(err.message);
        } finally {
            setCreating(false);
        }
    }

    const hasFilters = statusFilter || priorityFilter || assigneeFilter;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-(--text-primary)">{t("tasks.title")}</h1>
                    <p className="mt-0.5 text-sm text-(--text-muted)">
                        {t("tasks.countInWorkspace", { n: total, s: total !== 1 ? "s" : "", workspace: currentWorkspace?.name })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadTasks}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-(--border) bg-(--bg-elevated) px-3 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t("tasks.refresh")}</span>
                    </button>
                    {canManageTasks && (
                        <button
                            onClick={() => setShowCreate((s) => !s)}
                            className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                        >
                            <Plus className="h-4 w-4" />
                            <span>{t("tasks.newTask")}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-(--text-muted)" />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-8 rounded-lg border border-(--border) bg-(--bg-elevated) px-2 text-xs text-(--text-secondary) focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                    <option value="">{t("tasks.filters.allStatuses")}</option>
                    {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
                <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="h-8 rounded-lg border border-(--border) bg-(--bg-elevated) px-2 text-xs text-(--text-secondary) focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                    <option value="">{t("tasks.filters.allPriorities")}</option>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
                </select>
                <select
                    value={assigneeFilter}
                    onChange={(e) => setAssigneeFilter(e.target.value)}
                    className="h-8 rounded-lg border border-(--border) bg-(--bg-elevated) px-2 text-xs text-(--text-secondary) focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                    <option value="">{t("tasks.filters.allAssignees")}</option>
                    <option value="me">{t("tasks.filters.assignedToMe")}</option>
                    {members.map((m) => (
                        <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                    ))}
                </select>
                {hasFilters && (
                    <button
                        onClick={() => { setStatusFilter(""); setPriorityFilter(""); setAssigneeFilter(""); }}
                        className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-(--text-muted) hover:text-(--text-secondary)"
                    >
                        <X className="h-3 w-3" /> {t("tasks.filters.clear")}
                    </button>
                )}
            </div>

            {/* Create form */}
            {showCreate && canManageTasks && (
                <form onSubmit={handleCreate} className="rounded-xl border border-(--border) bg-(--bg-elevated) p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-(--text-primary)">{t("tasks.newTaskFormTitle")}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <input
                                type="text"
                                placeholder={t("tasks.taskTitleRequired")}
                                value={form.title}
                                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                className="w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-brand-500 focus:outline-none"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <textarea
                                placeholder={t("tasks.descriptionOptional")}
                                rows={2}
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                className="w-full resize-none rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-brand-500 focus:outline-none"
                            />
                        </div>
                        <select
                            value={form.projectId}
                            onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                            className="rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-secondary) focus:outline-none"
                        >
                            <option value="">{t("tasks.selectProject")}</option>
                            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select
                            value={form.priority}
                            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                            className="rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-secondary) focus:outline-none"
                        >
                            {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
                        </select>
                        <select
                            value={form.status}
                            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                            className="rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-secondary) focus:outline-none"
                        >
                            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                        </select>
                        <input
                            type="date"
                            value={form.dueDate}
                            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                            className="rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-secondary) focus:outline-none"
                        />
                        <div className="sm:col-span-2">
                            <p className="mb-1 text-xs text-(--text-muted)">{t("tasks.assignees")}</p>
                            <MultiAssigneePicker
                                members={members}
                                selected={assigneeIds}
                                onChange={setAssigneeIds}
                            />
                        </div>
                    </div>
                    {formError && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>
                    )}
                    <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm text-(--text-secondary) hover:text-(--text-primary)">{t("common.cancel")}</button>
                        <button
                            type="submit"
                            disabled={creating}
                            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                        >
                            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            {t("tasks.createTask")}
                        </button>
                    </div>
                </form>
            )}

            {/* Task list */}
            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-20 animate-pulse rounded-xl bg-(--border)" />
                    ))}
                </div>
            ) : error ? (
                <div className="rounded-xl border border-(--border) bg-(--bg-elevated) p-8 text-center">
                    <AlertCircle className="mx-auto h-6 w-6 text-red-500" />
                    <p className="mt-2 text-sm text-(--text-muted)">{error}</p>
                </div>
            ) : tasks.length === 0 ? (
                <div className="rounded-xl border border-(--border) bg-(--bg-elevated) p-12 text-center">
                    <CircleDot className="mx-auto h-8 w-8 text-(--text-muted)" />
                    <p className="mt-3 text-sm font-medium text-(--text-primary)">{t("tasks.noTasksFound")}</p>
                    <p className="mt-1 text-xs text-(--text-muted)">
                        {hasFilters ? t("tasks.emptyWithFilters") : t("tasks.emptyCreate")}
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-(--border) bg-(--bg-elevated)">
                    {tasks.map((task, idx) => (
                        <Link
                            key={task.id}
                            href={`/projects/${task.project.id}/tasks/${task.id}`}
                            className={[
                                "flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-(--bg-overlay)",
                                idx > 0 ? "border-t border-(--border)" : "",
                            ].join(" ")}
                        >
                            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_COLOR[task.status]}`} />

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-(--text-primary) leading-snug">{task.title}</p>
                                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_COLOR[task.priority]}`}>
                                        {priorityLabel(task.priority)}
                                    </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-(--text-muted)">
                                    <span className="flex items-center gap-1">
                                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[task.status]}`} />
                                        {statusLabel(task.status)}
                                    </span>
                                    <span className="text-(--text-muted)">·</span>
                                    <span>{task.project.name}</span>
                                    {(() => {
                                        const people = (task.assignees || []).map((a) => a.user).filter(Boolean);
                                        if (people.length === 0 && task.assignee) people.push(task.assignee);
                                        if (people.length === 0) return null;
                                        return (
                                            <>
                                                <span className="text-(--text-muted)">·</span>
                                                <AssigneeAvatars task={task} />
                                            </>
                                        );
                                    })()}
                                    {task.dueDate && (
                                        <>
                                            <span className="text-(--text-muted)">·</span>
                                            <span className="flex items-center gap-1">
                                                <CalendarDays className="h-3 w-3" />
                                                {formatDate(task.dueDate)}
                                            </span>
                                        </>
                                    )}
                                    {task._count?.comments > 0 && (
                                        <>
                                            <span className="text-(--text-muted)">·</span>
                                            <span>{t("tasks.commentCount", { n: task._count.comments, s: task._count.comments !== 1 ? "s" : "" })}</span>
                                        </>
                                    )}
                                </div>
            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
