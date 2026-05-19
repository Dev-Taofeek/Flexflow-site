"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock3, MessageSquare, Tag, User2 } from "lucide-react";

import { RichTextEditor } from "@/components/issues/RichTextEditor";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { socket } from "@/lib/socket";
import { createIssueComment, updateIssue } from "@/lib/issues-api";

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function getInitials(name) {
    return name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
}

export function IssueDetailView({
    project,
    issue: initialIssue,
    comments: initialComments,
    activityLog: initialActivityLog,
    people = [],
    availableLabels = [],
    token,
}) {
    const [issue, setIssue] = useState(initialIssue);
    const [comments, setComments] = useState(initialComments ?? []);
    const [activityLog, setActivityLog] = useState(initialActivityLog ?? []);
    const [title, setTitle] = useState(initialIssue?.title ?? "");
    const [description, setDescription] = useState(initialIssue?.description ?? "");
    const [newComment, setNewComment] = useState("");
    const [saving, setSaving] = useState(false);

    // Real-time updates via Socket.io
    useEffect(() => {
        if (!project?.id) return;
        socket.connect();
        socket.emit("project:join", project.id);

        function onIssueUpdated(payload) {
            if (payload.issue?.id !== issue?.id) return;
            setIssue(payload.issue);
            if (payload.activity) setActivityLog((prev) => [payload.activity, ...prev]);
        }
        function onCommentCreated(payload) {
            if (payload.issueId !== issue?.id) return;
            setComments((prev) => [...prev, payload.comment]);
            if (payload.activity) setActivityLog((prev) => [payload.activity, ...prev]);
        }

        socket.on("issue:updated", onIssueUpdated);
        socket.on("issue:comment-created", onCommentCreated);

        return () => {
            socket.emit("project:leave", project.id);
            socket.off("issue:updated", onIssueUpdated);
            socket.off("issue:comment-created", onCommentCreated);
            socket.disconnect();
        };
    }, [project?.id, issue?.id]);

    async function saveIssue(payload) {
        setSaving(true);
        try {
            const updated = await updateIssue({
                projectId: project.id,
                issueId: issue.id,
                payload,
                token,
            });
            setIssue(updated);
        } catch (err) {
            console.error("Failed to update issue:", err);
        } finally {
            setSaving(false);
        }
    }

    async function handleCommentSubmit(e) {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            await createIssueComment({
                projectId: project.id,
                issueId: issue.id,
                content: newComment.trim(),
                token,
            });
            setNewComment("");
        } catch (err) {
            console.error("Failed to post comment:", err);
        }
    }

    // Label helpers — API returns [{ label: { id, name, color } }]
    const activeLabels = issue?.labels?.map((l) => l.label?.name ?? l) ?? [];

    if (!issue) return null;

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
                            {issue.status}
                        </span>
                        <span className="rounded-full border border-(--border) bg-(--bg-sunken) px-2.5 py-1 text-xs font-medium text-(--text-secondary)">
                            {issue.priority}
                        </span>
                    </div>

                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => title !== issue.title && saveIssue({ title })}
                        className="w-full bg-transparent text-2xl font-semibold tracking-tight text-(--text-primary) outline-none placeholder-(--text-muted) border-none"
                        placeholder="Issue title"
                    />

                    <div className="mt-6">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-(--text-primary)">Description</h2>
                            <Button size="sm" disabled={saving} onClick={() => saveIssue({ description })}>
                                Save
                            </Button>
                        </div>
                        <RichTextEditor value={description} onChange={setDescription} />
                    </div>
                </section>

                {/* Comments */}
                <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <MessageSquare className="h-4 w-4 text-(--text-muted)" />
                        <h2 className="text-sm font-semibold text-(--text-primary)">
                            Comments <span className="text-(--text-muted) font-normal">({comments.length})</span>
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {comments.map((comment) => (
                            <article key={comment.id} className="flex gap-3">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-500 text-[10px] font-semibold text-white mt-0.5">
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
                            <p className="text-sm text-(--text-muted) text-center py-4">No comments yet.</p>
                        )}
                    </div>

                    <form onSubmit={handleCommentSubmit} className="mt-5">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Write a comment..."
                            rows={3}
                            className="w-full resize-none rounded-xl border border-(--border) bg-(--bg) px-4 py-3 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-indigo-500 focus:outline-none"
                        />
                        <div className="mt-3 flex justify-end">
                            <Button type="submit" disabled={!newComment.trim()}>Post comment</Button>
                        </div>
                    </form>
                </section>
            </div>

            {/* Sidebar */}
            <aside className="space-y-5">
                <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-5">
                    <h2 className="text-sm font-semibold text-(--text-primary) mb-5">Issue details</h2>

                    <div className="space-y-4">
                        {/* Status */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-(--text-muted)">
                                <Clock3 className="h-3 w-3" /> Status
                            </label>
                            <select
                                value={issue.status}
                                onChange={(e) => { setIssue((p) => ({ ...p, status: e.target.value })); saveIssue({ status: e.target.value }); }}
                                className="h-9 w-full rounded-lg border border-(--border) bg-(--bg) px-3 text-sm text-(--text-primary) focus:border-indigo-500 focus:outline-none"
                            >
                                {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                            </select>
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-(--text-muted)">
                                <Tag className="h-3 w-3" /> Priority
                            </label>
                            <select
                                value={issue.priority}
                                onChange={(e) => { setIssue((p) => ({ ...p, priority: e.target.value })); saveIssue({ priority: e.target.value }); }}
                                className="h-9 w-full rounded-lg border border-(--border) bg-(--bg) px-3 text-sm text-(--text-primary) focus:border-indigo-500 focus:outline-none"
                            >
                                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>

                        {/* Assignee */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-(--text-muted)">
                                <User2 className="h-3 w-3" /> Assignee
                            </label>
                            <select
                                value={issue.assigneeId ?? issue.assignee?.id ?? ""}
                                onChange={(e) => { saveIssue({ assigneeId: e.target.value || null }); }}
                                className="h-9 w-full rounded-lg border border-(--border) bg-(--bg) px-3 text-sm text-(--text-primary) focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="">Unassigned</option>
                                {people.map((p) => (
                                    <option key={p.id ?? p} value={p.id ?? p}>{p.name ?? p}</option>
                                ))}
                            </select>
                        </div>

                        {/* Due date */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-(--text-muted)">
                                <Calendar className="h-3 w-3" /> Due date
                            </label>
                            <input
                                type="date"
                                value={issue.dueDate ? new Date(issue.dueDate).toISOString().split("T")[0] : ""}
                                onChange={(e) => { setIssue((p) => ({ ...p, dueDate: e.target.value })); saveIssue({ dueDate: e.target.value || null }); }}
                                className="h-9 w-full rounded-lg border border-(--border) bg-(--bg) px-3 text-sm text-(--text-primary) focus:border-indigo-500 focus:outline-none"
                            />
                        </div>

                        {/* Labels */}
                        {availableLabels.length > 0 && (
                            <div>
                                <label className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-(--text-muted)">
                                    <Tag className="h-3 w-3" /> Labels
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {availableLabels.map((label) => {
                                        const name = label.name ?? label;
                                        const active = activeLabels.includes(name);
                                        return (
                                            <button
                                                key={name}
                                                type="button"
                                                className={["rounded-full px-2.5 py-1 text-xs font-medium border transition-colors",
                                                    active ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-(--border) bg-(--bg) text-(--text-secondary) hover:border-indigo-300"
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
                        <h2 className="text-sm font-semibold text-(--text-primary) mb-4">Activity</h2>
                        <div className="space-y-4">
                            {activityLog.map((activity) => (
                                <div key={activity.id} className="flex gap-2.5">
                                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
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
