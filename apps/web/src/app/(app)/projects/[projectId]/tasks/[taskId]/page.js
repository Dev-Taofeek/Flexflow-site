"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { fetchTask } from "@/lib/tasks-api";
import dynamic from "next/dynamic";

const TaskDetailView = dynamic(
    () => import("@/components/tasks/TaskDetailView").then((m) => m.TaskDetailView),
    {
        loading: () => <div className="h-96 animate-pulse rounded-xl bg-(--border)" />,
        ssr: false,
    }
);

export default function TaskDetailPage() {
    const { projectId, taskId } = useParams();
    const { accessToken, isReady } = useApp();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isReady || !accessToken) return;
        fetchTask({ projectId, taskId, token: accessToken })
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [projectId, taskId, accessToken, isReady]);

    if (loading) return <div className="h-96 animate-pulse rounded-xl bg-(--border)" />;
    if (error || !data) return (
        <div className="rounded-xl border border-(--border) bg-(--bg-elevated) p-8 text-center">
            <p className="text-sm text-(--text-muted)">{error || "Task not found"}</p>
        </div>
    );

    return (
        <TaskDetailView
            project={data.project}
            task={data.task}
            comments={data.comments}
            activityLog={data.activityLog}
            people={data.people}
            availableLabels={data.availableLabels}
            token={accessToken}
        />
    );
}
