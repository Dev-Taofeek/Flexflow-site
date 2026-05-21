"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
    AlertCircle, CalendarDays, ChevronDown, CircleDot,
    Filter, Loader2, Plus, RefreshCw, X,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { apiRequest } from "@/lib/api-client";
import { fetchProjects } from "@/lib/projects-api";

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const STATUS_COLOR = {
    TODO: "bg-zinc-400",
    IN_PROGRESS: "bg-blue-500",
    IN_REVIEW: "bg-amber-500",
    DONE: "bg-emerald-500",
};
const STATUS_LABEL = {
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    IN_REVIEW: "In Review",
    DONE: "Done",
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

export default function IssuesPage() {
    const { currentWorkspace, currentWorkspaceId, accessToken, isReady } = useApp();

    const [issues, setIssues] = useState([]);
    const [projects, setProjects] = useState([]);
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
    const [form, setForm] = useState({ title: "", description: "", projectId: "", priority: "MEDIUM", status: "TODO", assigneeId: "", dueDate: "" });
    const [formError, setFormError] = useState("");

    const loadIssues = useCallback(async () => {
        if (!isReady || !currentWorkspaceId || !accessToken) return;
        setLoading(true);
        setError(null);
        try {
            const params = { workspaceId: currentWorkspaceId };
            if (statusFilter) params.status = statusFilter;
            if (priorityFilter) params.priority = priorityFilter;
            if (assigneeFilter) params.assigneeId = assigneeFilter;
            const data = await apiRequest("/issues", { token: accessToken, params });
            setIssues(data.issues);
            setTotal(data.total);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [isReady, currentWorkspaceId, accessToken, statusFilter, priorityFilter, assigneeFilter]);

    useEffect(() => {
        loadIssues();
    }, [loadIssues]);

    useEffect(() => {
        if (!isReady || !currentWorkspaceId || !accessToken) return;
        fetchProjects({ workspaceId: currentWorkspaceId, token: accessToken })
            .then(setProjects)
            .catch(() => {});
    }, [isReady, currentWorkspaceId, accessToken]);

    async function handleCreate(e) {
        e.preventDefault();
        if (!form.title.trim()) { setFormError("Title is required"); return; }
        if (!form.projectId) { setFormError("Select a project"); return; }
        setFormError("");
        setCreating(true);
        try {
            const issue = await apiRequest("/issues", {
                method: "POST",
                token: accessToken,
                body: {
                    ...form,
                    assigneeId: form.assigneeId || null,
                    dueDate: form.dueDate || null,
                },
            });
            setIssues((prev) => [issue, ...prev]);
            setTotal((t) => t + 1);
            setForm({ title: "", description: "", projectId: "", priority: "MEDIUM", status: "TODO", assigneeId: "", dueDate: "" });
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
                    <h1 className="text-xl font-semibold text-(--text-primary)">Issues</h1>
                    <p className="mt-0.5 text-sm text-(--text-muted)">
                        {total} issue{total !== 1 ? "s" : ""} in {currentWorkspace?.name}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadIssues}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-(--border) bg-(--bg-elevated) px-3 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                    <button
                        onClick={() => setShowCreate((s) => !s)}
                        className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                    >
                        <Plus className="h-4 w-4" />
                        <span>New Issue</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-(--text-muted)" />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-8 rounded-lg border border-(--border) bg-(--bg-elevated) px-2 text-xs text-(--text-secondary) focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                    <option value="">All statuses</option>
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="h-8 rounded-lg border border-(--border) bg-(--bg-elevated) px-2 text-xs text-(--text-secondary) focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                    <option value="">All priorities</option>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                    value={assigneeFilter}
                    onChange={(e) => setAssigneeFilter(e.target.value)}
                    className="h-8 rounded-lg border border-(--border) bg-(--bg-elevated) px-2 text-xs text-(--text-secondary) focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                    <option value="">All assignees</option>
                    <option value="me">Assigned to me</option>
                </select>
                {hasFilters && (
                    <button
                        onClick={() => { setStatusFilter(""); setPriorityFilter(""); setAssigneeFilter(""); }}
                        className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-(--text-muted) hover:text-(--text-secondary)"
                    >
                        <X className="h-3 w-3" /> Clear
                    </button>
                )}
            </div>

            {/* Create form */}
            {showCreate && (
                <form onSubmit={handleCreate} className="rounded-xl border border-(--border) bg-(--bg-elevated) p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-(--text-primary)">New issue</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <input
                                type="text"
                                placeholder="Issue title *"
                                value={form.title}
                                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                className="w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-indigo-500 focus:outline-none"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <textarea
                                placeholder="Description (optional)"
                                rows={2}
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                className="w-full resize-none rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-indigo-500 focus:outline-none"
                            />
                        </div>
                        <select
                            value={form.projectId}
                            onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                            className="rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-secondary) focus:outline-none"
                        >
                            <option value="">Select project *</option>
                            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select
                            value={form.priority}
                            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                            className="rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-secondary) focus:outline-none"
                        >
                            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select
                            value={form.status}
                            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                            className="rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-secondary) focus:outline-none"
                        >
                            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                        <input
                            type="date"
                            value={form.dueDate}
                            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                            className="rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-secondary) focus:outline-none"
                        />
                    </div>
                    {formError && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>
                    )}
                    <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm text-(--text-secondary) hover:text-(--text-primary)">Cancel</button>
                        <button
                            type="submit"
                            disabled={creating}
                            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            Create issue
                        </button>
                    </div>
                </form>
            )}

            {/* Issue list */}
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
            ) : issues.length === 0 ? (
                <div className="rounded-xl border border-(--border) bg-(--bg-elevated) p-12 text-center">
                    <CircleDot className="mx-auto h-8 w-8 text-(--text-muted)" />
                    <p className="mt-3 text-sm font-medium text-(--text-primary)">No issues found</p>
                    <p className="mt-1 text-xs text-(--text-muted)">
                        {hasFilters ? "Try clearing your filters" : "Create your first issue to get started"}
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-(--border) bg-(--bg-elevated)">
                    {issues.map((issue, idx) => (
                        <Link
                            key={issue.id}
                            href={`/projects/${issue.project.id}/issues/${issue.id}`}
                            className={[
                                "flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-(--bg-overlay)",
                                idx > 0 ? "border-t border-(--border)" : "",
                            ].join(" ")}
                        >
                            {/* Status dot */}
                            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_COLOR[issue.status]}`} />

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-(--text-primary) leading-snug">{issue.title}</p>
                                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_COLOR[issue.priority]}`}>
                                        {issue.priority}
                                    </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-(--text-muted)">
                                    <span className="flex items-center gap-1">
                                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[issue.status]}`} />
                                        {STATUS_LABEL[issue.status]}
                                    </span>
                                    <span className="text-(--text-muted)">·</span>
                                    <span>{issue.project.name}</span>
                                    {issue.assignee && (
                                        <>
                                            <span className="text-(--text-muted)">·</span>
                                            <span className="flex items-center gap-1">
                                                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-700">
                                                    {issue.assignee.name?.[0]?.toUpperCase()}
                                                </div>
                                                {issue.assignee.name}
                                            </span>
                                        </>
                                    )}
                                    {issue.dueDate && (
                                        <>
                                            <span className="text-(--text-muted)">·</span>
                                            <span className="flex items-center gap-1">
                                                <CalendarDays className="h-3 w-3" />
                                                {formatDate(issue.dueDate)}
                                            </span>
                                        </>
                                    )}
                                    {issue._count?.comments > 0 && (
                                        <>
                                            <span className="text-(--text-muted)">·</span>
                                            <span>{issue._count.comments} comment{issue._count.comments !== 1 ? "s" : ""}</span>
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
