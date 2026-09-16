"use client";

import { FolderKanban } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/i18n";

export function ProjectProgressWidget({ projects }) {
  const { t } = useI18n();
  return (
    <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-6">
      <div>
        <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
          {t("dashboard.projectProgressTitle")}
        </h2>

        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
          {t("dashboard.projectProgressSubtitle")}
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background py-10 text-center dark:border-border-dark dark:bg-background-dark">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted dark:bg-muted-dark">
              <FolderKanban className="text-muted-foreground dark:text-muted-foreground-dark h-5 w-5" />
            </div>
            <p className="text-foreground dark:text-foreground-dark mt-3 text-sm font-medium">
              {t("dashboard.noProjects")}
            </p>
            <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
              {t("dashboard.noProjectsHint")}
            </p>
            <Link
              href="/projects"
              className="text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 mt-4 text-xs font-medium transition-colors"
            >
              {t("dashboard.createProject")}
            </Link>
          </div>
        ) : (
          <>
        {projects.map((project) => (
          <div key={project.id}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-foreground dark:text-foreground-dark text-sm font-medium">
                  {project.name}
                </h3>

                <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                  {t("dashboard.tasksCompleted", {
                    completed: project.completedTasks,
                    total: project.totalTasks,
                  })}
                </p>
              </div>

              <span className="text-foreground dark:text-foreground-dark text-sm font-semibold">
                {project.progress}%
              </span>
            </div>

            <div className="bg-muted dark:bg-muted-dark mt-3 h-2 overflow-hidden rounded-full">
              <div
                className="bg-brand-600 dark:bg-brand-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${project.progress}%`,
                }}
              />
            </div>
          </div>
        ))}
          </>
        )}
      </div>
    </section>
  );
}
