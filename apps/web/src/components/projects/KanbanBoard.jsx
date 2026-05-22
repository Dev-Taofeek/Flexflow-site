"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    DndContext, DragOverlay, PointerSensor,
    closestCorners, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import {
    SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, GripVertical, Loader2, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { updateIssueStatus } from "@/lib/projects-api";
import { apiRequest } from "@/lib/api-client";
import { socket } from "@/lib/socket";
import { useRole } from "@/hooks/useRole";

const COLUMNS = [
    { id: "TODO",        title: "To Do",       color: "bg-zinc-400" },
    { id: "IN_PROGRESS", title: "In Progress",  color: "bg-blue-500" },
    { id: "IN_REVIEW",   title: "In Review",    color: "bg-amber-500" },
    { id: "DONE",        title: "Done",         color: "bg-emerald-500" },
];

const PRIORITY_STYLE = {
    LOW:    "text-zinc-500 bg-zinc-100",
    MEDIUM: "text-blue-600 bg-blue-50",
    HIGH:   "text-orange-600 bg-orange-50",
    URGENT: "text-red-600 bg-red-50",
};

function groupByStatus(issues) {
    return COLUMNS.reduce((acc, col) => {
        acc[col.id] = issues.filter((i) => i.status === col.id);
        return acc;
    }, {});
}

function formatDate(d) {
    if (!d) return null;
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Inline create form per column ──────────────────────────────────────────
function QuickCreate({ projectId, status, members, token, onCreated, onCancel }) {
    const [title, setTitle] = useState("");
    const [assigneeId, setAssigneeId] = useState("");
    const [priority, setPriority] = useState("MEDIUM");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    async function submit(e) {
        e.preventDefault();
        if (!title.trim()) { setErr("Title required"); return; }
        setLoading(true);
        try {
            const issue = await apiRequest("/issues", {
                method: "POST",
                token,
                body: { projectId, title: title.trim(), status, priority, assigneeId: assigneeId || null },
            });
            onCreated(issue);
        } catch (ex) {
            setErr(ex.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={submit} className="mt-2 rounded-xl border border-indigo-300 bg-(--bg-elevated) p-3 space-y-2 shadow-sm">
            <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Issue title…"
                className="w-full rounded-lg border border-(--border) bg-(--bg) px-2.5 py-1.5 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-indigo-500 focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
                <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="rounded-lg border border-(--border) bg-(--bg) px-2 py-1.5 text-xs text-(--text-secondary) focus:outline-none"
                >
                    {["LOW","MEDIUM","HIGH","URGENT"].map((p) => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
                <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="rounded-lg border border-(--border) bg-(--bg) px-2 py-1.5 text-xs text-(--text-secondary) focus:outline-none"
                >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                        <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                    ))}
                </select>
            </div>
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex items-center justify-end gap-1.5">
                <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-(--text-muted) hover:bg-(--bg-overlay)">
                    <X className="h-4 w-4" />
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Add
                </button>
            </div>
        </form>
    );
}

// ── Issue card ─────────────────────────────────────────────────────────────
function IssueCard({ issue, isDragging = false, projectId }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: issue.id,
        data: { type: "issue", issue },
    });

    const style = { transform: CSS.Transform.toString(transform), transition };

    const dueDate = formatDate(issue.dueDate);
    const isOverdue = issue.dueDate && new Date(issue.dueDate) < new Date() && issue.status !== "DONE";

    return (
        <article
            ref={setNodeRef}
            style={style}
            className={[
                "group rounded-xl border bg-(--bg-elevated) p-3 shadow-sm transition-all",
                isDragging ? "opacity-40 scale-95" : "border-(--border) hover:border-indigo-300 hover:shadow-md",
            ].join(" ")}
        >
            {/* Top row: title + drag handle */}
            <div className="flex items-start gap-2">
                <Link
                    href={`/projects/${projectId}/issues/${issue.id}`}
                    className="flex-1 min-w-0"
                >
                    <p className="text-sm font-medium text-(--text-primary) leading-snug line-clamp-2 hover:text-indigo-600 transition-colors">
                        {issue.title}
                    </p>
                </Link>
                <button
                    type="button"
                    aria-label={`Drag ${issue.title}`}
                    className="mt-0.5 shrink-0 cursor-grab rounded-md p-0.5 text-(--text-muted) opacity-0 group-hover:opacity-100 hover:bg-(--bg-overlay) active:cursor-grabbing transition-opacity"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
            </div>

            {/* Bottom row: priority + assignee + due date */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[issue.priority]}`}>
                    {issue.priority}
                </span>

                {(() => {
                    const people = (issue.assignees || []).map((a) => a.user).filter(Boolean);
                    if (people.length === 0 && issue.assignee) people.push(issue.assignee);
                    if (people.length === 0) return null;
                    return (
                        <div className="flex items-center -space-x-1">
                            {people.slice(0, 3).map((u) => (
                                <div
                                    key={u.id}
                                    title={u.name}
                                    className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-(--bg-elevated) bg-indigo-100 text-[9px] font-bold text-indigo-700 shrink-0"
                                >
                                    {u.name?.[0]?.toUpperCase()}
                                </div>
                            ))}
                            {people.length > 3 && (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-(--bg-elevated) bg-zinc-200 text-[9px] font-bold text-zinc-600 shrink-0">
                                    +{people.length - 3}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {dueDate && (
                    <span className={`flex items-center gap-0.5 text-[11px] ${isOverdue ? "text-red-500 font-medium" : "text-(--text-muted)"}`}>
                        <CalendarDays className="h-3 w-3" />
                        {dueDate}
                    </span>
                )}
            </div>
        </article>
    );
}

// ── Column ─────────────────────────────────────────────────────────────────
function KanbanColumn({ column, issues, children, projectId, members, token, onCreated }) {
    const { setNodeRef, isOver } = useDroppable({ id: column.id });
    const { canWrite } = useRole();
    const [creating, setCreating] = useState(false);

    return (
        <section
            ref={setNodeRef}
            className={[
                "flex w-72 shrink-0 flex-col rounded-2xl border bg-(--bg-elevated) md:w-auto md:min-w-0",
                isOver ? "border-indigo-400 bg-indigo-50/30" : "border-(--border)",
            ].join(" ")}
        >
            {/* Column header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-(--border)">
                <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${column.color}`} />
                    <h2 className="text-sm font-semibold text-(--text-primary)">{column.title}</h2>
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-(--bg-overlay) px-1 text-[11px] font-medium text-(--text-muted)">
                        {issues.length}
                    </span>
                </div>
                {canWrite && (
                    <button
                        aria-label={`Add issue to ${column.title}`}
                        onClick={() => setCreating(true)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-(--text-muted) hover:bg-(--bg-overlay) hover:text-indigo-600 transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[calc(100vh-16rem)]">
                {children}

                {creating && (
                    <QuickCreate
                        projectId={projectId}
                        status={column.id}
                        members={members}
                        token={token}
                        onCreated={(issue) => { onCreated(issue, column.id); setCreating(false); }}
                        onCancel={() => setCreating(false)}
                    />
                )}

                {issues.length === 0 && !creating && canWrite && (
                    <button
                        onClick={() => setCreating(true)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-(--border) py-6 text-xs text-(--text-muted) transition-colors hover:border-indigo-300 hover:text-indigo-500"
                    >
                        <Plus className="h-3.5 w-3.5" /> Add issue
                    </button>
                )}
            </div>
        </section>
    );
}

// ── Board ─────────────────────────────────────────────────────────────────
export function KanbanBoard({ projectId, initialIssues, token, members = [] }) {
    const [issuesByStatus, setIssuesByStatus] = useState(() => groupByStatus(initialIssues));
    const [activeIssue, setActiveIssue] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const issueLookup = useMemo(() => (
        Object.values(issuesByStatus).flat().reduce((acc, i) => { acc[i.id] = i; return acc; }, {})
    ), [issuesByStatus]);

    useEffect(() => {
        socket.connect();
        socket.emit("project:join", projectId);
        function onStatusUpdated(payload) {
            if (payload.projectId !== projectId) return;
            setIssuesByStatus((cur) => {
                const next = Object.fromEntries(
                    Object.entries(cur).map(([s, issues]) => [s, issues.filter((i) => i.id !== payload.issue.id)])
                );
                next[payload.issue.status] = [payload.issue, ...(next[payload.issue.status] || [])];
                return next;
            });
        }
        socket.on("issue:status-updated", onStatusUpdated);
        return () => {
            socket.emit("project:leave", projectId);
            socket.off("issue:status-updated", onStatusUpdated);
            socket.disconnect();
        };
    }, [projectId]);

    function findColumn(id) {
        if (issuesByStatus[id]) return id;
        return Object.keys(issuesByStatus).find((s) => issuesByStatus[s].some((i) => i.id === id));
    }

    function handleDragStart({ active }) {
        setActiveIssue(issueLookup[active.id] || null);
    }

    function handleDragOver({ active, over }) {
        if (!over) return;
        const fromCol = findColumn(active.id);
        const toCol = findColumn(over.id);
        if (!fromCol || !toCol || fromCol === toCol) return;
        setIssuesByStatus((cur) => ({
            ...cur,
            [fromCol]: cur[fromCol].filter((i) => i.id !== active.id),
            [toCol]: [{ ...issueLookup[active.id], status: toCol }, ...cur[toCol]],
        }));
    }

    async function handleDragEnd({ active, over }) {
        setActiveIssue(null);
        if (!over) return;
        const fromCol = findColumn(active.id);
        const toCol = findColumn(over.id);
        if (!fromCol || !toCol) return;

        if (fromCol === toCol) {
            setIssuesByStatus((cur) => {
                const items = cur[fromCol];
                const oi = items.findIndex((i) => i.id === active.id);
                const ni = items.findIndex((i) => i.id === over.id);
                if (oi === -1 || ni === -1) return cur;
                return { ...cur, [fromCol]: arrayMove(items, oi, ni) };
            });
            return;
        }

        try {
            await updateIssueStatus({ projectId, issueId: active.id, status: toCol, token });
        } catch {
            setIssuesByStatus(groupByStatus(initialIssues));
        }
    }

    function handleCreated(issue, colId) {
        setIssuesByStatus((cur) => ({
            ...cur,
            [colId]: [issue, ...(cur[colId] || [])],
        }));
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            {/* Horizontal scroll on mobile, 4-col grid on xl */}
            <div className="flex gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-2 xl:grid-cols-4">
                {COLUMNS.map((col) => {
                    const colIssues = issuesByStatus[col.id] || [];
                    return (
                        <KanbanColumn
                            key={col.id}
                            column={col}
                            issues={colIssues}
                            projectId={projectId}
                            members={members}
                            token={token}
                            onCreated={handleCreated}
                        >
                            <SortableContext items={colIssues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                                {colIssues.map((issue) => (
                                    <IssueCard key={issue.id} issue={issue} projectId={projectId} />
                                ))}
                            </SortableContext>
                        </KanbanColumn>
                    );
                })}
            </div>

            <DragOverlay>
                {activeIssue ? <IssueCard issue={activeIssue} projectId={projectId} isDragging /> : null}
            </DragOverlay>
        </DndContext>
    );
}
