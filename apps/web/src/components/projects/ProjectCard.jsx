import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/Badge";

export function ProjectCard({ project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group border-border bg-surface hover:border-brand-500/40 dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className="h-12 w-12 rounded-2xl"
          style={{
            backgroundColor: `${project.color}20`,
          }}
        >
          <div
            className="flex h-full w-full items-center justify-center rounded-2xl text-sm font-semibold"
            style={{
              color: project.color,
            }}
          >
            {project.name.slice(0, 2).toUpperCase()}
          </div>
        </div>

        <ArrowUpRight
          className="text-muted-foreground dark:text-muted-foreground-dark h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          strokeWidth={1.5}
        />
      </div>

      <div className="mt-5">
        <h3 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
          {project.name}
        </h3>

        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-2 text-sm leading-relaxed">
          {project.description}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Badge variant="secondary">{project.visibility}</Badge>

        <span className="text-foreground dark:text-foreground-dark text-sm font-medium">
          {project.progress}%
        </span>
      </div>

      <div className="bg-muted dark:bg-muted-dark mt-3 h-2 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${project.progress}%`,
            backgroundColor: project.color,
          }}
        />
      </div>
    </Link>
  );
}
