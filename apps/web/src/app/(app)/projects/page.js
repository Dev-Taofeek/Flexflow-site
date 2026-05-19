"use client";

import { useEffect, useState } from "react";
import { Plus, FolderKanban } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { fetchProjects, createProject } from "@/lib/projects-api";
import { ProjectsClient } from "@/components/projects/ProjectsClient";

export default function ProjectsPage() {
  const { currentWorkspace, accessToken, isReady } = useApp();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", visibility: "PRIVATE" });

  useEffect(() => {
    if (!isReady || !currentWorkspace?.id || !accessToken) return;
    load();
  }, [currentWorkspace?.id, accessToken, isReady]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjects({ workspaceId: currentWorkspace.id, token: accessToken });
      setProjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const project = await createProject(
        { ...form, workspaceId: currentWorkspace.id },
        accessToken
      );
      setProjects((prev) => [project, ...prev]);
      setForm({ name: "", description: "", visibility: "PRIVATE" });
      setShowForm(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-(--text-primary)">Projects</h1>
          <p className="mt-0.5 text-sm text-(--text-muted)">
            {projects.length} project{projects.length !== 1 ? "s" : ""} in{" "}
            {currentWorkspace?.name || "this workspace"}
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> New Project
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-xl border border-(--border) bg-(--bg-elevated) p-5"
        >
          <h3 className="text-sm font-semibold text-(--text-primary)">New project</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
                Name *
              </label>
              <input
                type="text"
                placeholder="Project name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
                Visibility
              </label>
              <select
                value={form.visibility}
                onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
                className="w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-indigo-500 focus:outline-none"
              >
                <option value="PRIVATE">Private</option>
                <option value="PUBLIC">Public</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
              Description
            </label>
            <textarea
              placeholder="What is this project about?"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full resize-none rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-2 text-sm text-(--text-secondary) transition-colors hover:text-(--text-primary)"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create project"}
            </button>
          </div>
        </form>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-(--border)" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-(--border) bg-(--bg-elevated) p-8 text-center">
          <p className="text-sm text-(--text-muted)">{error}</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-(--border) bg-(--bg-elevated) p-12 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-(--text-muted)" />
          <p className="mt-3 text-sm font-medium text-(--text-primary)">No projects yet</p>
          <p className="mt-1 text-sm text-(--text-muted)">
            Create your first project to get started.
          </p>
        </div>
      ) : (
        <ProjectsClient initialProjects={projects} onRefresh={load} token={accessToken} />
      )}
    </div>
  );
}
