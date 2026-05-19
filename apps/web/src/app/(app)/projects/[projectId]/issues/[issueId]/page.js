"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { fetchIssue } from "@/lib/issues-api";
import { IssueDetailView } from "@/components/issues/IssueDetailView";

export default function IssueDetailPage() {
    const { projectId, issueId } = useParams();
    const { accessToken, isReady } = useApp();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isReady || !accessToken) return;
        fetchIssue({ projectId, issueId, token: accessToken })
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [projectId, issueId, accessToken, isReady]);

    if (loading) return <div className="h-96 animate-pulse rounded-xl bg-(--border)" />;
    if (error || !data) return (
        <div className="rounded-xl border border-(--border) bg-(--bg-elevated) p-8 text-center">
            <p className="text-sm text-(--text-muted)">{error || "Issue not found"}</p>
        </div>
    );

    return (
        <IssueDetailView
            project={data.project}
            issue={data.issue}
            comments={data.comments}
            activityLog={data.activityLog}
            people={data.people}
            availableLabels={data.availableLabels}
            token={accessToken}
        />
    );
}
