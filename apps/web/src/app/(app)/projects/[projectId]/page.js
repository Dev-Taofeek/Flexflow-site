"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { fetchProject } from "@/lib/projects-api";
import dynamic from "next/dynamic";

const KanbanBoard = dynamic(
    () => import("@/components/projects/KanbanBoard").then((m) => m.KanbanBoard),
    {
        loading: () => <div className="h-96 animate-pulse rounded-xl bg-(--border)" />,
        ssr: false,
    }
);

export default function ProjectDetailPage() {
    const { projectId } = useParams();
    const { accessToken, isReady } = useApp();
    const [project, setProject] = useState(null);
    const [issues, setIssues] = useState([]);
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between rounded-xl border border-(--border) bg-(--bg-elevated) p-5">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color || "#6366f1" }} />
                    <div>
                        <h1 className="text-lg font-semibold text-(--text-primary)">{project.name}</h1>
                        {project.description && (
                            <p className="mt-1 text-sm text-(--text-secondary) max-w-xl">{project.description}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4 text-right shrink-0">
                    <div>
                        <p className="text-xs text-(--text-muted)">Progress</p>
                        <p className="text-2xl font-semibold text-(--text-primary)">{progress}%</p>
                    </div>
                    <div>
                        <p className="text-xs text-(--text-muted)">Issues</p>
                        <p className="text-2xl font-semibold text-(--text-primary)">{total}</p>
                    </div>
                </div>
            </div>

            <KanbanBoard projectId={project.id} initialIssues={issues} token={accessToken} />
        </div>
    );
}
