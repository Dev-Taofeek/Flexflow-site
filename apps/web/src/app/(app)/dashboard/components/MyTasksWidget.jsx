import { Badge } from "@/components/ui/Badge";

const priorityVariantMap = {
  LOW: "secondary",
  MEDIUM: "secondary",
  HIGH: "destructive",
  URGENT: "destructive",
};

export function MyTasksWidget({ tasks }) {
  return (
    <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
            My Tasks
          </h2>

          <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
            Assigned issues across your projects
          </p>
        </div>

        <Badge variant="secondary">{tasks.length} Active</Badge>
      </div>

      <div className="mt-6 space-y-4">
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
              </div>

              <Badge variant={priorityVariantMap[task.priority]}>{task.priority}</Badge>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Badge variant="ghost">{task.status}</Badge>

              <p className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                Due {task.dueDate}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
