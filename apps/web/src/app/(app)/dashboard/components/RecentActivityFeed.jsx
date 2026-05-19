import { Avatar } from "@/components/ui/Avatar";

export function RecentActivityFeed({ activities }) {
  return (
    <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-6">
      <div>
        <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
          Recent Activity
        </h2>

        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
          Team updates and issue events happening now
        </p>
      </div>

      <div className="mt-6 space-y-5">
        {activities.map((activity, index) => (
          <div key={activity.id} className="relative flex gap-4">
            {index !== activities.length - 1 ? (
              <span className="bg-border dark:bg-border-dark absolute top-10 left-5 h-full w-px" />
            ) : null}

            <Avatar
              fallback={activity.actor
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
              size="sm"
            />

            <div className="flex-1 pb-4">
              <p className="text-foreground dark:text-foreground-dark text-sm leading-relaxed">
                <span className="font-medium">{activity.actor}</span> {activity.action}{" "}
                <span className="font-medium">{activity.target}</span>
              </p>

              <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                {new Date(activity.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
