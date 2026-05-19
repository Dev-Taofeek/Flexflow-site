import { CalendarDays } from "lucide-react";

import { Badge } from "@/components/ui/Badge";

export function UpcomingDeadlines({ deadlines }) {
  return (
    <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-6">
      <div>
        <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
          Upcoming Deadlines
        </h2>

        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
          Important milestones and delivery targets
        </p>
      </div>

      <div className="mt-6 space-y-4">
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
                  {deadline.title}
                </h3>

                <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                  {deadline.project}
                </p>
              </div>
            </div>

            <Badge variant="secondary">{deadline.dueDate}</Badge>
          </div>
        ))}
      </div>
    </section>
  );
}
