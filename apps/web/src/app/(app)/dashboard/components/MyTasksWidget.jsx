"use client";

import { Badge } from "@/components/ui/Badge";
import { ListTodo } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/i18n";

const priorityVariantMap = {
  LOW: "secondary",
  MEDIUM: "secondary",
  HIGH: "destructive",
  URGENT: "destructive",
};

export function MyTasksWidget({ tasks }) {
  const { t } = useI18n();
  return (
    <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
            {t("dashboard.myTasksTitle")}
          </h2>

          <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
            {t("dashboard.myTasksSubtitle")}
          </p>
        </div>

        <Badge variant="secondary">{t("dashboard.activeCount", { n: tasks.length })}</Badge>
      </div>

      <div className="mt-6 space-y-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background py-10 text-center dark:border-border-dark dark:bg-background-dark">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted dark:bg-muted-dark">
              <ListTodo className="text-muted-foreground dark:text-muted-foreground-dark h-5 w-5" />
            </div>
            <p className="text-foreground dark:text-foreground-dark mt-3 text-sm font-medium">
              {t("dashboard.noTasks")}
            </p>
            <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
              {t("dashboard.noTasksHint")}
            </p>
            <Link
              href="/tasks"
              className="text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 mt-4 text-xs font-medium transition-colors"
            >
              {t("dashboard.browseAllTasks")}
            </Link>
          </div>
        ) : (
          <>
        {tasks.map((task) => (
          <div
            key={task.id}
            className="border-border bg-background hover:bg-muted/40 dark:border-border-dark dark:bg-background-dark dark:hover:bg-muted-dark/40 rounded-2xl border p-4 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-foreground dark:text-foreground-dark text-sm font-medium">
                  {task.title}
                </h3>

                <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                  {task.project}
                </p>
                {task.assignees?.length > 1 && (
                  <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                    {t("dashboard.assignedWithOther", { n: task.assignees.length - 1 })}
                  </p>
                )}
              </div>

              <Badge variant={priorityVariantMap[task.priority]}>{task.priority}</Badge>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Badge variant="ghost">{task.status}</Badge>

              <p className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                {t("dashboard.due", { date: task.dueDate })}
              </p>
            </div>
          </div>
        ))}
          </>
        )}
      </div>
    </section>
  );
}
