"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Check, Clock3, MessageSquare, Tag, User2, X } from "lucide-react";
import { apiRequest } from "@/lib/api-client";

import dynamic from "next/dynamic";

const RichTextEditor = dynamic(
    () => import("@/components/tasks/RichTextEditor").then((m) => m.RichTextEditor),
    {
        loading: () => <div className="h-32 animate-pulse rounded-lg bg-(--border)" />,
        ssr: false,
    }
);
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { socket } from "@/lib/socket";
import { createTaskComment, updateTask, updateTaskStatus } from "@/lib/tasks-api";
import { useRole } from "@/hooks/useRole";
import { useApp } from "@/contexts/AppContext";
import { canChangeTaskStatus, isTaskAssignee, isTaskCreator, WORK_STATES } from "@/lib/task-permissions";
import { useI18n } from "@/i18n";

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function getInitials(name) {
    return name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function AssigneePicker({ task, people, token, onUpdated, disabled = false }) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const ref = useRef(null);

    // Current assignee IDs from the junction table
    const currentIds = new Set(
        (task.assignees || []).map((a) => a.userId || a.user?.id).filter(Boolean)
    );

    useEffect(() => {
        function handler(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    async function toggle(userId) {
        const next = new Set(currentIds);
        if (next.has(userId)) next.delete(userId); else next.add(userId);
        setSaving(true);
        try {
            const updated = await apiRequest(`/tasks/${task.id}/assignees`, {
                method: "PATCH",
                token,
                body: { assigneeIds: [...next] },
            });
            onUpdated(updated);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    }

    const assigned = (task.assignees || []).map((a) => a.user || { id: a.userId, name: t("tasks.unknown") });

    return (
        <div ref={ref} className="relative">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-(--text-muted)">
                <User2 className="h-3 w-3" /> {t("tasks.assignees")}
            </label>

            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                disabled={disabled}
                className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-(--border) bg-(--bg) px-2.5 py-1.5 text-left text-sm transition-colors hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
                {assigned.length === 0 ? (
                    <span className="text-(--text-muted) text-sm">{t("tasks.unassigned")}</span>
                ) : (
                    assigned.map((u) => (
                        <span key={u.id} className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-200 text-[9px] font-bold">
                                {u.name?.[0]?.toUpperCase()}
                            </span>
                            {u.name}
                        </span>
                    ))
                )}
            </button>

            {open && (
                <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-(--border) bg-(--bg-elevated) py-1 shadow-lg">
                    {people.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-(--text-muted)">{t("tasks.noMembersInWorkspace")}</p>
                    ) : (
                        people.map((p) => {
                            const id = p.id ?? p;
                            const name = p.name ?? p;
                            const checked = currentIds.has(id);
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => toggle(id)}
                                    disabled={saving}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-(--bg-overlay) disabled:opacity-50"
                                >
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                                        {name?.[0]?.toUpperCase()}
                                    </div>
                                    <span className="flex-1 text-(--text-primary)">{name}</span>
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

export function TaskDetailView({
    project,
    task: initialTask,
    comments: initialComments,
    activityLog: initialActivityLog,
    people = [],
    availableLabels = [],
    token,
}) {
    const { canManageTasks } = useRole();
    const { user } = useApp();
    const { t } = useI18n();
    const currentUserId = user?.id;
    const [task, setTask] = useState(initialTask);
    const [comments, setComments] = useState(initialComments ?? []);
    const [activityLog, setActivityLog] = useState(initialActivityLog ?? []);
    const [title, setTitle] = useState(initialTask?.title ?? "");
    const [description, setDescription] = useState(initialTask?.description ?? "");
    const [newComment, setNewComment] = useState("");
    const [saving, setSaving] = useState(false);
    const [statusSaving, setStatusSaving] = useState(false);

    // Real-time updates via Socket.io
    useEffect(() => {
        if (!project?.id) return;
        socket.emit("project:join", project.id);

        function onTaskUpdated(payload) {
            if (payload.task?.id !== task?.id) return;
            setTask(payload.task);
            if (payload.activity) setActivityLog((prev) => [payload.activity, ...prev]);
        }
        function onCommentCreated(payload) {
            if (payload.taskId !== task?.id) return;
            setComments((prev) => [...prev, payload.comment]);
            if (payload.activity) setActivityLog((prev) => [payload.activity, ...prev]);
        }

        socket.on("task:updated", onTaskUpdated);
        socket.on("task:comment-created", onCommentCreated);

        return () => {
            socket.emit("project:leave", project.id);
            socket.off("task:updated", onTaskUpdated);
            socket.off("task:comment-created", onCommentCreated);
        };
    }, [project?.id, task?.id]);

    async function saveTask(payload) {
        setSaving(true);
        try {
            const updated = await updateTask({
                projectId: project.id,
                taskId: task.id,
                payload,
                token,
            });
            setTask(updated);
        } catch (err) {
            console.error("Failed to update task:", err);
        } finally {
            setSaving(false);
        }
    }

    async function handleCommentSubmit(e) {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            await createTaskComment({
                projectId: project.id,
                taskId: task.id,
                content: newComment.trim(),
                token,
            });
            setNewComment("");
        } catch (err) {
            console.error("Failed to post comment:", err);
        }
    }

    const canChangeStatus = canChangeTaskStatus(currentUserId, task, canManageTasks);
    const isAssigneeOnly = !canManageTasks && !isTaskCreator(currentUserId, task) && isTaskAssignee(currentUserId, task);
    const statusOptions = isAssigneeOnly ? WORK_STATES : STATUSES;
    const canSubmitReview = isAssigneeOnly && ["TODO", "IN_PROGRESS"].includes(task?.status);
    const assignerName = task?.createdBy?.name || null;

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

    async function handleStatusChange(next) {
        setTask((p) => ({ ...p, status: next }));
        setStatusSaving(true);
        try {
            const updated = await updateTaskStatus({ projectId: project.id, taskId: task.id, status: next, token });
            setTask(updated);
        } catch (err) {
            console.error("Failed to update status:", err);
        } finally {
            setStatusSaving(false);
        }
    }

    async function handleSubmitReview() {
        await handleStatusChange("IN_REVIEW");
    }

    // Label helpers — API returns [{ label: { id, name, color } }]
    const activeLabels = task?.labels?.map((l) => l.label?.name ?? l) ?? [];

    if (!task) return null;

    return (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            {/* Main column */}
            <div className="space-y-5">
                {/* Header + description */}
                <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-6">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="rounded-full border border-(--border) bg-(--bg-sunken) px-2.5 py-1 text-xs font-medium text-(--text-secondary)">
                            {project?.name}
                        </span>
                        <span className="rounded-full border border-(--border) bg-(--bg-sunken) px-2.5 py-1 text-xs font-medium text-(--text-secondary)">
                            {statusLabel(task.status)}
                        </span>
                        <span className="rounded-full border border-(--border) bg-(--bg-sunken) px-2.5 py-1 text-xs font-medium text-(--text-secondary)">
                            {priorityLabel(task.priority)}
                        </span>
                    </div>

                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => title !== task.title && saveTask({ title })}
                        readOnly={!canManageTasks}
                        className="w-full bg-transparent text-2xl font-semibold tracking-tight text-(--text-primary) outline-none placeholder-(--text-muted) border-none"
                        placeholder={t("tasks.taskTitlePlaceholder")}
                    />

                    <div className="mt-6">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-(--text-primary)">{t("tasks.description")}</h2>
                            {canManageTasks && (
                                <Button size="sm" disabled={saving} onClick={() => saveTask({ description })}>
                                    {t("common.save")}
                                </Button>
                            )}
                        </div>
                        <RichTextEditor value={description} onChange={setDescription} readOnly={!canManageTasks} />
                    </div>
                </section>

                {/* Comments */}
                <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <MessageSquare className="h-4 w-4 text-(--text-muted)" />
                        <h2 className="text-sm font-semibold text-(--text-primary)">
                            {t("tasks.comments")} <span className="text-(--text-muted) font-normal">({comments.length})</span>
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {comments.map((comment) => (
                            <article key={comment.id} className="flex gap-3">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-violet-500 text-[10px] font-semibold text-white mt-0.5">
                                    {getInitials(comment.author?.name ?? comment.author)}
                                </div>
                                <div className="flex-1 rounded-xl border border-(--border) bg-(--bg) p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-medium text-(--text-primary)">
                                            {comment.author?.name ?? comment.author}
                                        </span>
                                        <span className="text-xs text-(--text-muted)">
                                            {new Date(comment.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-(--text-secondary) leading-relaxed whitespace-pre-wrap">
                                        {comment.content ?? comment.body}
                                    </p>
                                </div>
                            </article>
                        ))}

                        {comments.length === 0 && (
                            <p className="text-sm text-(--text-muted) text-center py-4">{t("tasks.noCommentsYet")}</p>
                        )}
                    </div>

                    <form onSubmit={handleCommentSubmit} className="mt-5">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder={t("tasks.commentPlaceholder")}
                            rows={3}
                            className="w-full resize-none rounded-xl border border-(--border) bg-(--bg) px-4 py-3 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-brand-500 focus:outline-none"
                        />
                        <div className="mt-3 flex justify-end">
                            <Button type="submit" disabled={!newComment.trim()}>{t("tasks.postComment")}</Button>
                        </div>
                    </form>
                </section>
            </div>

            {/* Sidebar */}
            <aside className="space-y-5">
                <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-5">
                    <h2 className="text-sm font-semibold text-(--text-primary) mb-5">{t("tasks.details")}</h2>

                    <div className="space-y-4">
                        {/* Status */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-(--text-muted)">
                                <Clock3 className="h-3 w-3" /> {t("tasks.status.title")}
                            </label>
                            <select
                                value={task.status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                disabled={!canChangeStatus || statusSaving}
                                className="h-9 w-full rounded-lg border border-(--border) bg-(--bg) px-3 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {statusOptions.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                            </select>

                            {canSubmitReview && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="mt-2 w-full"
                                    isLoading={statusSaving}
                                    onClick={handleSubmitReview}
                                >
                                    {t("tasks.submitForReview")}
                                </Button>
                            )}

                            {task.status === "IN_REVIEW" && (
                                <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                                    {t("tasks.awaitingReview", { from: assignerName ? ` from ${assignerName}` : "" })}
                                </p>
                            )}
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-(--text-muted)">
                                <Tag className="h-3 w-3" /> {t("tasks.priority.title")}
                            </label>
                            <select
                                value={task.priority}
                                onChange={(e) => { setTask((p) => ({ ...p, priority: e.target.value })); saveTask({ priority: e.target.value }); }}
                                disabled={!canManageTasks}
                                className="h-9 w-full rounded-lg border border-(--border) bg-(--bg) px-3 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
                            </select>
                        </div>

                        {/* Assignees — multi-select */}
                        <AssigneePicker
                            task={task}
                            people={people}
                            token={token}
                            onUpdated={(updated) => setTask(updated)}
                            disabled={!canManageTasks}
                        />

                        {/* Due date */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-(--text-muted)">
                                <Calendar className="h-3 w-3" /> {t("tasks.dueDate")}
                            </label>
                            <input
                                type="date"
                                value={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
                                onChange={(e) => { setTask((p) => ({ ...p, dueDate: e.target.value })); saveTask({ dueDate: e.target.value || null }); }}
                                disabled={!canManageTasks}
                                className="h-9 w-full rounded-lg border border-(--border) bg-(--bg) px-3 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            />
                        </div>

                        {/* Labels */}
                        {availableLabels.length > 0 && (
                            <div>
                                <label className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-(--text-muted)">
                                    <Tag className="h-3 w-3" /> {t("tasks.labels")}
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {availableLabels.map((label) => {
                                        const name = label.name ?? label;
                                        const active = activeLabels.includes(name);
                                        return (
                                            <button
                                                key={name}
                                                type="button"
                                                disabled={!canManageTasks}
                                                className={["rounded-full px-2.5 py-1 text-xs font-medium border transition-colors disabled:cursor-not-allowed",
                                                    active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-(--border) bg-(--bg) text-(--text-secondary) hover:border-brand-300"
                                                ].join(" ")}
                                            >
                                                {name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Activity log */}
                {activityLog.length > 0 && (
                    <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-5">
                        <h2 className="text-sm font-semibold text-(--text-primary) mb-4">{t("tasks.activity")}</h2>
                        <div className="space-y-4">
                            {activityLog.map((activity) => (
                                <div key={activity.id} className="flex gap-2.5">
                                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                                    <div>
                                        <p className="text-sm text-(--text-primary)">
                                            <span className="font-medium">{activity.user?.name ?? activity.actor}</span>
                                            {" "}{activity.action}
                                        </p>
                                        <p className="mt-0.5 text-xs text-(--text-muted)">
                                            {new Date(activity.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </aside>
        </div>
    );
}
