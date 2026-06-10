"use client";

import { useEffect, useState } from "react";

import { PermissionMatrix } from "@/components/settings/roles/PermissionMatrix";
import { useApp } from "@/contexts/AppContext";
import { fetchRolesData } from "@/lib/roles-api";

export default function RolesSettingsPage() {
  const { currentWorkspace, accessToken, isReady } = useApp();
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isReady || !currentWorkspace?.id || !accessToken) return;

    setLoading(true);
    setError("");
    fetchRolesData(currentWorkspace.id, accessToken)
      .then(setResponse)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [accessToken, currentWorkspace?.id, isReady]);

  return (
    <div className="space-y-6">
      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-8">
        <p className="text-brand-600 dark:text-brand-400 text-sm font-medium">Settings / Roles</p>

        <h1 className="text-foreground dark:text-foreground-dark mt-2 text-3xl font-semibold tracking-tight">
          Role permissions
        </h1>

        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-3 max-w-2xl text-sm leading-relaxed">
          Manage the permission matrix for Owner, Admin, Member, and Viewer roles across workspace
          resources.
        </p>
      </section>

      {loading ? (
        <div className="h-80 animate-pulse rounded-3xl border border-(--border) bg-(--bg-elevated)" />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <PermissionMatrix
          workspaceId={currentWorkspace.id}
          token={accessToken}
          roles={response.roles}
          resources={response.resources}
          initialPermissions={response.permissions}
        />
      )}
    </div>
  );
}
