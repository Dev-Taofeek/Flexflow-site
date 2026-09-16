"use client";

import { CalendarDays, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/i18n";
import { Translated } from "@/lib/translate";

export function UpcomingDeadlines({ deadlines }) {
  const { t } = useI18n();
  return (
    <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-6">
      <div>
        <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
          {t("dashboard.upcomingDeadlinesTitle")}
        </h2>

        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
          {t("dashboard.upcomingDeadlinesSubtitle")}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {deadlines.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background py-10 text-center dark:border-border-dark dark:bg-background-dark">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted dark:bg-muted-dark">
              <Clock3 className="text-muted-foreground dark:text-muted-foreground-dark h-5 w-5" />
            </div>
            <p className="text-foreground dark:text-foreground-dark mt-3 text-sm font-medium">
              {t("dashboard.noDeadlines")}
            </p>
            <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
              {t("dashboard.noDeadlinesHint")}
            </p>
          </div>
        ) : (
          <>
        {deadlines.map((deadline) => (
          <div
            key={deadline.id}
            className="border-border bg-background dark:border-border-dark dark:bg-background-dark flex items-center justify-between rounded-2xl border p-4"
          >
            <div className="flex items-start gap-3">
              <div className="bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 flex h-10 w-10 items-center justify-center rounded-xl">
                <CalendarDays className="h-5 w-5" />
              </div>

              <div>
                <h3 className="text-foreground dark:text-foreground-dark text-sm font-medium">
                  <Translated>{deadline.title}</Translated>
                </h3>

                <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                  <Translated>{deadline.project}</Translated>
                </p>
                {deadline.assignees?.length > 0 && (
                  <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                    {t("dashboard.assigneeCount", { n: deadline.assignees.length })}
                  </p>
                )}
              </div>
            </div>

            <Badge variant="secondary">{deadline.dueDate}</Badge>
          </div>
        ))}
          </>
        )}
      </div>
    </section>
  );
}