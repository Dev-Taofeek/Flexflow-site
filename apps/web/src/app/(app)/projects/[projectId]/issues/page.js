import Link from "next/link";
import { ArrowUpRight, CalendarDays, CircleDot } from "lucide-react";

import { Badge } from "@/components/ui/Badge";

import { fetchProjects } from "@/lib/projects-api";

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

export default async function IssuesPage() {
  const response = await fetchProjects();

  const projects = response.data;

  const issues = projects.flatMap((project) =>
    (project.issues || []).map((issue) => ({
      ...issue,
      project,
    }))
  );

  return (
    <div className="space-y-6">
      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-8">
        <p className="text-brand-600 dark:text-brand-400 text-sm font-medium">Issues</p>

        <h1 className="text-foreground dark:text-foreground-dark mt-2 text-3xl font-semibold tracking-tight">
          Track and manage all issues
        </h1>

        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-3 max-w-2xl text-sm leading-relaxed">
          Monitor tasks, blockers, reviews, and completed work across every active project
          workspace.
        </p>
      </section>

      <div className="grid gap-4">
        {issues.map((issue) => (
          <Link
            key={issue.id}
            href={`/projects/${issue.project.id}/issues/${issue.id}`}
            className="group border-border bg-surface hover:border-brand-500/40 dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">{issue.project.name}</Badge>

                  <div className="flex items-center gap-2">
                    <span
                      className={["h-2.5 w-2.5 rounded-full", getStatusColor(issue.status)].join(
                        " "
                      )}
                    />

                    <span className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-medium">
                      {issue.status}
                    </span>
                  </div>
                </div>

                <h2 className="text-foreground dark:text-foreground-dark mt-4 text-xl font-semibold">
                  {issue.title}
                </h2>

                <p className="text-muted-foreground dark:text-muted-foreground-dark mt-2 line-clamp-2 text-sm leading-relaxed">
                  {issue.description?.replace(/<[^>]*>/g, "")?.slice(0, 180)}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Badge variant="outline">{issue.priority}</Badge>

                  <div className="text-muted-foreground dark:text-muted-foreground-dark flex items-center gap-2 text-xs">
                    <CircleDot className="h-3.5 w-3.5" strokeWidth={1.8} />

                    {issue.assignee}
                  </div>

                  <div className="text-muted-foreground dark:text-muted-foreground-dark flex items-center gap-2 text-xs">
                    <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.8} />

                    {issue.dueDate}
                  </div>
                </div>
              </div>

              <ArrowUpRight
                className="text-muted-foreground dark:text-muted-foreground-dark h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={1.5}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
