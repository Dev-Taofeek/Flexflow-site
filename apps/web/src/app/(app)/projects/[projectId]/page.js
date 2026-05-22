"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, Clock } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { apiRequest } from "@/lib/api-client";
import { fetchProject } from "@/lib/projects-api";
import dynamic from "next/dynamic";

const KanbanBoard = dynamic(
    () => import("@/components/projects/KanbanBoard").then((m) => m.KanbanBoard),
    {
        loading: () => <div className="h-96 animate-pulse rounded-xl bg-(--border)" />,
        ssr: false,
    }
);

const INITIAL_ACTIVITY_LIMIT = 5;

function ActivityFeed({ projectId, token }) {
    const [activities, setActivities] = useState([]);
    const [total, setTotal] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        if (!projectId || !token) return;
        setLoading(true);
        apiRequest(`/projects/${projectId}/activity`, {
            token,
            params: { limit: INITIAL_ACTIVITY_LIMIT, skip: 0 },
        })
            .then((data) => { setActivities(data.activities || []); setTotal(data.total || 0); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [projectId, token]);

    async function loadAll() {
        setLoadingMore(true);
        try {
            const data = await apiRequest(`/projects/${projectId}/activity`, {
                token,
                params: { limit: 100, skip: 0 },
            });
            setActivities(data.activities || []);
            setExpanded(true);
        } catch {}
        finally { setLoadingMore(false); }
    }

    function formatTime(d) {
        const date = new Date(d);
        const diff = (Date.now() - date.getTime()) / 1000;
        if (diff < 60) return "just now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    if (loading) {
        return (
            <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-(--border)" />)}
            </div>
        );
    }

    if (activities.length === 0) {
        return <p className="text-sm text-(--text-muted)">No activity yet.</p>;
    }

    return (
        <div className="space-y-1">
            {activities.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-(--bg-overlay) transition-colors">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                        {a.user?.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-(--text-primary)">
                            <span className="font-medium">{a.user?.name}</span>
                            {" "}<span className="text-(--text-muted)">{a.action}</span>
                            {a.issue?.title && (
                                <> <span className="text-(--text-secondary) font-medium">"{a.issue.title}"</span></>
                            )}
                        </p>
                    </div>
                    <span className="shrink-0 text-xs text-(--text-muted) whitespace-nowrap">{formatTime(a.createdAt)}</span>
                </div>
            ))}

            {!expanded && total > INITIAL_ACTIVITY_LIMIT && (
                <button
                    onClick={loadAll}
                    disabled={loadingMore}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-(--border) py-2 text-xs text-(--text-secondary) hover:bg-(--bg-overlay) transition-colors mt-1"
                >
                    {loadingMore ? (
                        <span className="animate-spin h-3 w-3 rounded-full border-2 border-indigo-500 border-t-transparent" />
                    ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    Load all activity ({total - INITIAL_ACTIVITY_LIMIT} more)
                </button>
            )}
        </div>
    );
}

export default function ProjectDetailPage() {
    const { projectId } = useParams();
    const { accessToken, isReady, currentOrg } = useApp();
    const [project, setProject] = useState(null);
    const [issues, setIssues] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isReady || !accessToken || !projectId) return;
        setLoading(true);
        fetchProject(projectId, accessToken)
            .then((data) => { setProject(data.project); setIssues(data.issues); })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [projectId, accessToken, isReady]);

    useEffect(() => {
        if (!isReady || !accessToken || !currentOrg?.id) return;
        apiRequest(`/organizations/${currentOrg.id}/members`, { token: accessToken })
            .then((data) => setMembers((data.members || []).map((m) => ({ user: m.user, role: m.role }))))
            .catch(() => {});
    }, [isReady, accessToken, currentOrg?.id]);

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-32 animate-pulse rounded-xl bg-(--border)" />
                <div className="h-96 animate-pulse rounded-xl bg-(--border)" />
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="rounded-xl border border-(--border) bg-(--bg-elevated) p-8 text-center">
                <p className="text-sm text-(--text-muted)">{error || "Project not found"}</p>
            </div>
        );
    }

    const total = issues.length;
    const done = issues.filter((i) => i.status === "DONE").length;
    const progress = total ? Math.round((done / total) * 100) : 0;

    return (
        <div className="space-y-5">
            {/* Project header */}
            <div className="flex flex-col gap-3 rounded-xl border border-(--border) bg-(--bg-elevated) p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color || "#6366f1" }} />
                    <div className="min-w-0">
                        <h1 className="text-base font-semibold text-(--text-primary) sm:text-lg">{project.name}</h1>
                        {project.description && (
                            <p className="mt-1 text-sm text-(--text-secondary) line-clamp-2">{project.description}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                        <p className="text-xs text-(--text-muted)">Progress</p>
                        <p className="text-xl font-semibold text-(--text-primary)">{progress}%</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-(--text-muted)">Issues</p>
                        <p className="text-xl font-semibold text-(--text-primary)">{total}</p>
                    </div>
                </div>
            </div>

            <KanbanBoard projectId={project.id} initialIssues={issues} token={accessToken} members={members} />

            {/* Activity feed */}
            <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-(--text-primary)">
                    <Clock className="h-4 w-4 text-(--text-muted)" />
                    Activity
                </h2>
                <ActivityFeed projectId={project.id} token={accessToken} />
            </section>
        </div>
    );
}
