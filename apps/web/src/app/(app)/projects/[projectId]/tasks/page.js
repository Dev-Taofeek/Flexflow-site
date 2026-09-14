"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, CircleDot, ListTodo } from "lucide-react";
import { useEffect, useState } from "react";

import { useApp } from "@/contexts/AppContext";
import { fetchProject } from "@/lib/projects-api";
import { Badge } from "@/components/ui/Badge";

function getStatusColor(status) {
  switch (status) {
    case "TODO":
      return "bg-zinc-500";
    case "IN_PROGRESS":
      return "bg-blue-500";
    case "IN_REVIEW":
      return "bg-amber-500";
    case "DONE":
      return "bg-emerald-500";
    default:
      return "bg-zinc-500";
  }
}

function formatDueDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProjectTasksPage() {
  const { projectId } = useParams();
  const { accessToken, isReady } = useApp();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isReady || !accessToken || !projectId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchProject(projectId, accessToken);
        if (!cancelled) {
          setProject(data.project);
          setTasks(data.tasks || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, accessToken, isReady]);

  if (loading || !isReady) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-3xl bg-(--border)" />
        <div className="h-64 animate-pulse rounded-3xl bg-(--border)" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-(--border) bg-surface py-24 text-center">
        <p className="text-sm font-medium text-(--text-primary)">Something went wrong</p>
        <p className="mt-1 text-sm text-(--text-muted)">{error || "Project not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-(--border) bg-surface p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-brand-600">{project.name}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-(--text-primary)">Tasks</h1>
            <p className="mt-2 text-sm leading-relaxed text-(--text-secondary)">
              Track and manage all tasks in this project.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-(--border) bg-(--bg) px-3 py-1 text-xs font-medium text-(--text-secondary)">
            {tasks.length} task{tasks.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-(--border) bg-surface py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--bg-overlay)">
            <ListTodo className="h-5 w-5 text-(--text-muted)" />
          </div>
          <p className="mt-4 text-sm font-medium text-(--text-primary)">No tasks yet</p>
          <p className="mt-1 max-w-sm text-sm text-(--text-muted)">
            Create a task from the project board to start tracking work here.
          </p>
          <Link
            href={`/projects/${project.id}`}
            className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            Open project board
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/projects/${project.id}/tasks/${task.id}`}
              className="group rounded-3xl border border-(--border) bg-surface p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-lg"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className={["h-2.5 w-2.5 rounded-full", getStatusColor(task.status)].join(" ")} />
                      <span className="text-xs font-medium text-(--text-muted)">{task.status}</span>
                    </div>
                    <Badge variant="outline">{task.priority}</Badge>
                  </div>

                  <h2 className="mt-4 text-xl font-semibold text-(--text-primary)">
                    {task.title}
                  </h2>

                  {task.description && (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-(--text-secondary)">
                      {task.description?.replace(/<[^>]*>/g, "")?.slice(0, 180)}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-4">
                    {task.assignee && (
                      <div className="flex items-center gap-2 text-xs text-(--text-muted)">
                        {task.assignee.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={task.assignee.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">
                            {task.assignee.name?.[0]?.toUpperCase() || "?"}
                          </span>
                        )}
                        <span>{task.assignee.name}</span>
                      </div>
                    )}

                    {formatDueDate(task.dueDate) && (
                      <div className="flex items-center gap-2 text-xs text-(--text-muted)">
                        <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.8} />
                        {formatDueDate(task.dueDate)}
                      </div>
                    )}
                  </div>
                </div>

                <CircleDot className="h-5 w-5 shrink-0 text-(--text-muted)" strokeWidth={1.5} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}